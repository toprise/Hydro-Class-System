/* eslint-disable no-await-in-loop */
import path from 'path';
import { ObjectId } from 'mongodb';
import PQueue from 'p-queue';
import superagent from 'superagent';
import WebSocket from 'ws';
import { fs } from '@hydrooj/utils';
import { LangConfig } from '@hydrooj/utils/lib/lang';
import * as sysinfo from '@hydrooj/utils/lib/sysinfo';
import type { JudgeResultBody } from 'hydrooj';
import { getConfig } from '../config';
import { FormatError, SystemError } from '../error';
import log from '../log';
import { JudgeTask } from '../task';
import { Lock } from '../utils';

function removeNixPath(text: string) {
    return text.replace(/\/nix\/store\/[a-z0-9]{32}-/g, '/nix/');
}

export default class Hydro {
    ws: WebSocket;
    language: Record<string, LangConfig>;

    constructor(public config) {
        this.config.detail ??= true;
        this.config.cookie ||= '';
        this.config.last_update_at ||= 0;
        if (!this.config.server_url.startsWith('http')) this.config.server_url = `http://${this.config.server_url}`;
        if (!this.config.server_url.endsWith('/')) this.config.server_url = `${this.config.server_url}/`;
        this.getLang = this.getLang.bind(this);
    }

    get(url: string) {
        url = new URL(url, this.config.server_url).toString();
        return superagent.get(url).set('Cookie', this.config.cookie);
    }

    post(url: string, data: any) {
        url = new URL(url, this.config.server_url).toString();
        return superagent.post(url).send(data)
            .set('Cookie', this.config.cookie)
            .set('Accept', 'application/json');
    }

    async init() {
        await this.setCookie(this.config.cookie || '');
        await this.ensureLogin();
        setInterval(() => { this.get(''); }, 30000000); // Cookie refresh only
    }

    async cacheOpen(source: string, files: any[], next?) {
        await Lock.acquire(`${this.config.host}/${source}`);
        try {
            return await this._cacheOpen(source, files, next);
        } catch (e) {
            log.warn('CacheOpen Fail: %s %o %o', source, files, e);
            throw e;
        } finally {
            Lock.release(`${this.config.host}/${source}`);
        }
    }

    async _cacheOpen(source: string, files: any[], next?) {
        const [domainId, pid] = source.split('/');
        const filePath = path.join(getConfig('cache_dir'), this.config.host, source);
        await fs.ensureDir(filePath);
        if (!files?.length) throw new FormatError('Problem data not found.');
        let etags: Record<string, string> = {};
        try {
            etags = JSON.parse(await fs.readFile(path.join(filePath, 'etags'), 'utf-8'));
        } catch (e) { /* ignore */ }
        const version = {};
        const filenames = [];
        const allFiles = new Set<string>();
        for (const file of files) {
            allFiles.add(file.name);
            version[file.name] = file.etag + file.lastModified;
            if (etags[file.name] !== file.etag + file.lastModified) filenames.push(file.name);
        }
        for (const name in etags) {
            if (!allFiles.has(name) && fs.existsSync(path.join(filePath, name))) await fs.remove(path.join(filePath, name));
        }
        if (filenames.length) {
            log.info(`Getting problem data: ${this.config.host}/${source}`);
            next?.({ message: 'Syncing testdata, please wait...' });
            await this.ensureLogin();
            const res = await this.post(`/d/${domainId}/judge/files`, {
                pid: +pid,
                files: filenames,
            });
            if (!res.body.links) throw new FormatError('problem not exist');
            const that = this;
            // eslint-disable-next-line no-inner-declarations
            async function download(name: string) {
                if (name.includes('/')) await fs.ensureDir(path.join(filePath, name.split('/')[0]));
                const w = fs.createWriteStream(path.join(filePath, name));
                that.get(res.body.links[name]).pipe(w);
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error(`DownloadTimeout(${name}, 60s)`)), 60000);
                    w.on('error', (e) => {
                        clearTimeout(timeout);
                        reject(new Error(`DownloadFail(${name}): ${e.message}`));
                    });
                    w.on('finish', () => {
                        clearTimeout(timeout);
                        resolve(null);
                    });
                });
            }
            const tasks = [];
            const queue = new PQueue({ concurrency: 10 });
            for (const name in res.body.links) {
                tasks.push(queue.add(() => download(name)));
            }
            queue.start();
            await Promise.all(tasks);
            await fs.writeFile(path.join(filePath, 'etags'), JSON.stringify(version));
        }
        await fs.writeFile(path.join(filePath, 'lastUsage'), new Date().getTime().toString());
        return filePath;
    }

    async fetchFile(name: string) {
        name = name.split('#')[0];
        const res = await this.post('judge/code', { id: name });
        const target = path.join(getConfig('tmp_dir'), name.replace(/\//g, '_'));
        const w = fs.createWriteStream(target);
        this.get(res.body.url).pipe(w);
        await new Promise((resolve, reject) => {
            w.on('finish', resolve);
            w.on('error', (e) => reject(new Error(`DownloadFail(${name}): ${e.message}`)));
        });
        return target;
    }

    getLang(name: string, doThrow = true) {
        if (this.language[name]) return this.language[name];
        if (name === 'cpp' && this.language.cc) return this.language.cc;
        if (doThrow) throw new SystemError('Unsupported language {0}', [name]);
        return null;
    }

    send(rid: string | ObjectId, key: 'next' | 'end', data: Partial<JudgeResultBody>) {
        data.rid = new ObjectId(rid);
        data.key = key;
        if (data.case && typeof data.case.message === 'string') data.case.message = removeNixPath(data.case.message);
        if (typeof data.message === 'string') data.message = removeNixPath(data.message);
        if (typeof data.compilerText === 'string') data.compilerText = removeNixPath(data.compilerText);
        this.ws.send(JSON.stringify(data));
    }

    getNext(t: JudgeTask) {
        return (data: Partial<JudgeResultBody>) => {
            log.debug('Next: %o', data);
            const performanceMode = getConfig('performance') || t.meta.rejudge || t.meta.hackRejudge;
            if (performanceMode && data.case && !data.compilerText && !data.message) {
                t.callbackCache ||= [];
                t.callbackCache.push(data.case);
            } else {
                this.send(t.request.rid, 'next', data);
            }
        };
    }

    getEnd(t: JudgeTask) {
        return (data: Partial<JudgeResultBody>) => {
            log.info('End: %o', data);
            if (t.callbackCache) data.cases = t.callbackCache;
            this.send(t.request.rid, 'end', data);
        };
    }

    async consume(queue: PQueue) {
        log.info('正在连接 %sjudge/conn', this.config.server_url);
        this.ws = new WebSocket(`${this.config.server_url.replace(/^http/i, 'ws')}judge/conn`, {
            headers: {
                Authorization: `Bearer ${this.config.cookie.split('sid=')[1].split(';')[0]}`,
            },
        });
        const content = this.config.minPriority !== undefined
            ? `{"key":"prio","prio":${this.config.minPriority}}`
            : '{"key":"ping"}';
        setInterval(() => this.ws?.send?.(content), 30000);
        this.ws.on('message', (data) => {
            const request = JSON.parse(data.toString());
            if (request.language) this.language = request.language;
            if (request.task) queue.add(() => new JudgeTask(this, request.task).handle().catch((e) => log.error(e)));
        });
        this.ws.on('close', (data, reason) => {
            log.warn(`[${this.config.host}] Websocket 断开:`, data, reason.toString());
            setTimeout(() => this.retry(queue), 30000);
        });
        this.ws.on('error', (e) => {
            log.error(`[${this.config.host}] Websocket 错误:`, e);
            setTimeout(() => this.retry(queue), 30000);
        });
        await new Promise((resolve) => {
            this.ws.once('open', async () => {
                if (!this.config.noStatus) {
                    const info = await sysinfo.get();
                    this.ws.send(JSON.stringify({ key: 'status', info }));
                    setInterval(async () => {
                        const [mid, inf] = await sysinfo.update();
                        this.ws.send(JSON.stringify({ key: 'status', info: { mid, ...inf } }));
                    }, 1200000);
                }
                resolve(null);
            });
        });
        log.info(`[${this.config.host}] 已连接`);
    }

    dispose() {
        this.ws?.close?.();
    }

    async setCookie(cookie: string) {
        this.config.cookie = cookie;
    }

    async login() {
        log.info('[%s] Updating session', this.config.host);
        const res = await this.post('login', {
            uname: this.config.uname, password: this.config.password, rememberme: 'on',
        });
        await this.setCookie(res.headers['set-cookie'].join(';'));
    }

    async ensureLogin() {
        try {
            const res = await this.get('judge/files').set('Accept', 'application/json');
            // Redirected to /login
            if (res.body.url) await this.login();
        } catch (e) {
            await this.login();
        }
    }

    async retry(queue: PQueue) {
        this.consume(queue).catch(() => {
            setTimeout(() => this.retry(queue), 30000);
        });
    }
}
