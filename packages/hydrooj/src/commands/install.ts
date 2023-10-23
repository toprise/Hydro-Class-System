import child from 'child_process';
import os from 'os';
import path from 'path';
import { CAC } from 'cac';
import fs from 'fs-extra';
import superagent from 'superagent';
import tar from 'tar';
import { Logger } from '@hydrooj/utils';

const logger = new Logger('install');
let yarnVersion = 0;
try {
    // eslint-disable-next-line no-unsafe-optional-chaining
    yarnVersion = +child.execSync('yarn --version', { cwd: os.tmpdir() }).toString().split('v').pop()!.split('.')[0];
} catch (e) {
    // yarn 2 does not support global dir
}

const hydroPath = path.resolve(os.homedir(), '.hydro');
const addonDir = path.join(hydroPath, 'addons');

export function register(cli: CAC) {
    cli.command('install [package]').action(async (_src) => {
        if (!_src) {
            cli.outputHelp();
            return;
        }
        if (yarnVersion !== 1) throw new Error('Yarn 1 is required.');
        let newAddonPath: string = '';
        fs.ensureDirSync(addonDir);
        let src = _src;
        if (!src.startsWith('http')) {
            try {
                src = child.execSync(`yarn info ${src} dist.tarball`, { cwd: os.tmpdir() })
                    .toString().trim().split('\n')[1];
            } catch (e) {
                throw new Error('Cannot fetch package info.');
            }
        }
        if (src.startsWith('@hydrooj/')) {
            src = child.execSync(`npm info ${src} dist.tarball`, { cwd: os.tmpdir() }).toString().trim();
            if (!src.startsWith('http')) throw new Error('Cannot fetch package info.');
        }
        if (src.startsWith('http')) {
            const url = new URL(src);
            const filename = url.pathname.split('/').pop()!;
            if (['.tar.gz', '.tgz', '.zip'].find((i) => filename.endsWith(i))) {
                const name = filename.replace(/(-?(\d+\.\d+\.\d+|latest))?(\.tar\.gz|\.zip|\.tgz)$/g, '');
                newAddonPath = path.join(addonDir, name);
                logger.info(`Downloading ${src} to ${newAddonPath}`);
                fs.ensureDirSync(newAddonPath);
                await new Promise((resolve, reject) => {
                    superagent.get(src)
                        .pipe(tar.x({
                            C: newAddonPath,
                            strip: 1,
                        }))
                        .on('finish', resolve)
                        .on('error', reject);
                });
            } else throw new Error('Unsupported file type');
        } else throw new Error(`Unsupported install source: ${src}`);
        if (!newAddonPath) throw new Error('Addon download failed');
        logger.info('Installing depedencies');
        if (!fs.existsSync(path.join(newAddonPath, 'package.json'))) throw new Error('Invalid plugin file');
        child.execSync('yarn --production', { stdio: 'inherit', cwd: newAddonPath });
        child.execSync(`hydrooj addon add '${newAddonPath}'`);
        fs.writeFileSync(path.join(newAddonPath, '__metadata__'), JSON.stringify({
            src: _src,
            lastUpdate: Date.now(),
        }));
    });
    cli.command('uninstall [package]').action(async (name) => {
        if (!name) {
            cli.outputHelp();
            return;
        }
        if (yarnVersion !== 1) throw new Error('Yarn 1 is required.');
        fs.ensureDirSync(addonDir);
        const plugins = fs.readdirSync(addonDir);
        if (!plugins.includes(name)) {
            throw new Error(`Plugin ${name} not found or not installed with \`hydrooj install\`.`);
        }
        const newAddonPath = path.join(addonDir, name);
        child.execSync(`hydrooj addon remove '${newAddonPath}'`, { stdio: 'inherit' });
        fs.removeSync(newAddonPath);
        logger.success(`Successfully uninstalled ${name}.`);
    });
}
