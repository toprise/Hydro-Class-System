import { PassThrough } from 'stream';
import type { Next } from 'koa';
import { cloneDeep, pick } from 'lodash';
import { PERM } from '../../model/builtin';
import * as system from '../../model/system';
import token from '../../model/token';
import type { HydroRequest, HydroResponse, KoaContext } from '../server';

export interface UiContextBase {
    cdn_prefix: string;
    url_prefix: string;
    ws_prefix: string;
}
export const UiContextBase: UiContextBase = {
    cdn_prefix: '/',
    url_prefix: '/',
    ws_prefix: '/',
};

export default async (ctx: KoaContext, next: Next) => {
    // Base Layer
    const { domainId, domainInfo } = ctx;
    const [xff, xhost] = system.getMany(['server.xff', 'server.xhost']);
    const request: HydroRequest = {
        method: ctx.request.method.toLowerCase(),
        host: ctx.request.headers[xhost?.toLowerCase() || ''] as string || ctx.request.host,
        hostname: ctx.request.hostname,
        ip: ctx.request.headers[xff?.toLowerCase() || ''] as string || ctx.request.ip,
        headers: ctx.request.headers,
        cookies: ctx.cookies,
        ...pick(ctx, ['query', 'path', 'params', 'originalPath', 'querystring']),
        body: ctx.request.body,
        files: ctx.request.files as any,
        referer: ctx.request.headers.referer || '',
        json: (ctx.request.headers.accept || '').includes('application/json'),
        websocket: ctx.request.headers.upgrade === 'websocket',
    };
    request.ip = request.ip.split(',')[0].trim();
    const response: HydroResponse = {
        body: {},
        type: '',
        status: null,
        template: null,
        redirect: null,
        attachment: (name, streamOrBuffer) => {
            ctx.attachment(name);
            if (streamOrBuffer instanceof Buffer) {
                response.body = null;
                ctx.body = streamOrBuffer;
            } else {
                response.body = null;
                ctx.body = streamOrBuffer.pipe(new PassThrough());
            }
        },
        addHeader: (name: string, value: string) => ctx.set(name, value),
        disposition: null,
    };
    const args = {
        domainId, ...ctx.params, ...ctx.query, ...ctx.request.body, __start: Date.now(),
    };
    const UiContext: any = cloneDeep(UiContextBase);
    if (!process.env.DEV) UiContext.cdn_prefix = system.get('server.cdn');
    if (!process.env.DEV) UiContext.ws_prefix = system.get('server.ws');
    UiContext.domainId = domainId;
    UiContext.domain = domainInfo;
    ctx.HydroContext = {
        request, response, UiContext, domain: domainInfo, user: null, args,
    };
    const header = ctx.request.headers.authorization;
    const sid = header
        ? header.split(' ')[1] // Accept bearer token
        : ctx.cookies.get('sid') || ctx.query.sid; // FIXME maybe a better way for shared conn?
    const session = sid ? await token.get(sid instanceof Array ? sid[0] : sid, token.TYPE_SESSION) : null;
    ctx.session = Object.create(session || { uid: 0, scope: PERM.PERM_ALL.toString() });
    await next();
    const ua = request.headers['user-agent'] || '';
    if (!ctx.session.uid && system.get('server.ignoreUA').replace(/\r/g, '').split('\n').filter((i) => i && ua.includes(i)).length) return;
    const expireSeconds = ctx.session.save
        ? system.get('session.saved_expire_seconds')
        : system.get('session.unsaved_expire_seconds');
    if (!ctx.session._id && !Object.getOwnPropertyNames(ctx.session).length) return;
    Object.assign(ctx.session, { updateIp: request.ip, updateUa: ua });
    if (ctx.session._id) {
        await token.update(ctx.session._id, token.TYPE_SESSION, expireSeconds, ctx.session);
    } else {
        Object.assign(ctx.session, { createIp: request.ip, createUa: ua, createHost: request.host });
        [ctx.session._id] = await token.add(token.TYPE_SESSION, expireSeconds, ctx.session);
    }
    if (!request.websocket) {
        const options: any = {
            expires: new Date(Date.now() + expireSeconds * 1000),
            httpOnly: false,
        };
        if (system.get('session.domain') && ctx.request.secure && ctx.request.host.endsWith(system.get('session.domain'))) {
            options.domain = system.get('session.domain');
            options.sameSite = 'none';
            options.secure = true;
        }
        ctx.cookies.set('sid', ctx.session._id, options);
    }
};
