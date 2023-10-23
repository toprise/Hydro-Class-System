import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import moment from 'moment-timezone';
import type { Binary } from 'mongodb';
import { Time } from '@hydrooj/utils';
import {
    AuthOperationError, BlacklistedError, BuiltinLoginError, ForbiddenError, InvalidTokenError,
    SystemError, UserAlreadyExistError, UserFacingError,
    UserNotFoundError, ValidationError, VerifyPasswordError,
} from '../error';
import { Udoc, User } from '../interface';
import avatar from '../lib/avatar';
import { sendMail } from '../lib/mail';
import { verifyTFA } from '../lib/verifyTFA';
import BlackListModel from '../model/blacklist';
import { PERM, PRIV, STATUS } from '../model/builtin';
import * as ContestModel from '../model/contest';
import domain from '../model/domain';
import oauth from '../model/oauth';
import * as oplog from '../model/oplog';
import problem, { ProblemDoc } from '../model/problem';
import ScheduleModel from '../model/schedule';
import SolutionModel from '../model/solution';
import * as system from '../model/system';
import token from '../model/token';
import user, { deleteUserCache } from '../model/user';
import {
    Handler, param, post, Types,
} from '../service/server';
import { registerResolver, registerValue } from './api';

registerValue('User', [
    ['_id', 'Int!'],
    ['uname', 'String!'],
    ['mail', 'String!'],
    ['perm', 'String'],
    ['role', 'String'],
    ['loginat', 'Date'],
    ['regat', 'Date!'],
    ['priv', 'Int!', 'User Privilege'],
    ['avatarUrl', 'String'],
    ['tfa', 'Boolean!'],
    ['authn', 'Boolean!'],
    ['displayName', 'String'],
]);

registerResolver('Query', 'user(id: Int, uname: String, mail: String)', 'User', (arg, ctx) => {
    if (arg.id) return user.getById(ctx.args.domainId, arg.id);
    if (arg.mail) return user.getByEmail(ctx.args.domainId, arg.mail);
    if (arg.uname) return user.getByUname(ctx.args.domainId, arg.uname);
    return ctx.user;
}, `Get a user by id, uname, or mail.
Returns current user if no argument is provided.`);

registerResolver('Query', 'users(ids: [Int], search: String, limit: Int, exact: Boolean)', '[User]', async (arg, ctx) => {
    if (arg.ids?.length) {
        const res = await user.getList(ctx.args.domainId, arg.ids);
        return Object.keys(res).map((id) => res[+id]);
    }
    if (!arg.search) return [];
    const udoc = await user.getById(ctx.args.domainId, +arg.search)
        || await user.getByUname(ctx.args.domainId, arg.search)
        || await user.getByEmail(ctx.args.domainId, arg.search);
    const udocs: User[] = arg.exact
        ? []
        : await user.getPrefixList(ctx.args.domainId, arg.search, Math.min(arg.limit || 10, 10));
    if (udoc && !udocs.find((i) => i._id === udoc._id)) {
        udocs.pop();
        udocs.unshift(udoc);
    }
    for (const i in udocs) {
        udocs[i].avatarUrl = avatar(udocs[i].avatar);
    }
    return udocs;
}, 'Get a list of user by ids, or search users with the prefix.');

class UserLoginHandler extends Handler {
    noCheckPermView = true;

    async get() {
        if (!system.get('server.login')) throw new BuiltinLoginError();
        this.response.template = 'user_login.html';
    }

    @param('uname', Types.Username)
    @param('password', Types.Password)
    @param('rememberme', Types.Boolean)
    @param('redirect', Types.String, true)
    @param('tfa', Types.String, true)
    @param('authnChallenge', Types.String, true)
    async post(
        domainId: string, uname: string, password: string, rememberme = false, redirect = '',
        tfa = '', authnChallenge = '',
    ) {
        if (!system.get('server.login')) throw new BuiltinLoginError();
        let udoc = await user.getByEmail(domainId, uname);
        udoc ||= await user.getByUname(domainId, uname);
        if (!udoc) throw new UserNotFoundError(uname);
        if (system.get('system.contestmode') && !udoc.hasPriv(PRIV.PRIV_EDIT_SYSTEM)) {
            if (udoc._loginip && udoc._loginip !== this.request.ip) throw new ValidationError('ip');
            if (system.get('system.contestmode') === 'strict') {
                const udocs = await user.getMulti({ loginip: this.request.ip, _id: { $ne: udoc._id } }).toArray();
                if (udocs.length) throw new ValidationError('ip');
            }
        }
        await Promise.all([
            this.limitRate('user_login', 60, 30, false),
            this.limitRate(`user_login_${uname}`, 60, 5, false),
            oplog.log(this, 'user.login', { redirect }),
        ]);
        if (udoc.tfa || udoc.authn) {
            if (udoc.tfa && tfa) {
                if (!verifyTFA(udoc._tfa, tfa)) throw new InvalidTokenError('2FA');
            } else if (udoc.authn && authnChallenge) {
                const challenge = await token.get(authnChallenge, token.TYPE_WEBAUTHN);
                if (!challenge || challenge.uid !== udoc._id) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_WEBAUTHN]);
                if (!challenge.verified) throw new ValidationError('challenge');
                await token.del(authnChallenge, token.TYPE_WEBAUTHN);
            } else throw new ValidationError('2FA', 'Authn');
        }
        udoc.checkPassword(password);
        await user.setById(udoc._id, { loginat: new Date(), loginip: this.request.ip });
        if (!udoc.hasPriv(PRIV.PRIV_USER_PROFILE)) throw new BlacklistedError(uname, udoc.banReason);
        this.session.viewLang = '';
        this.session.uid = udoc._id;
        this.session.sudo = null;
        this.session.scope = PERM.PERM_ALL.toString();
        this.session.save = rememberme;
        this.response.redirect = (redirect ? decodeURIComponent(redirect) : '')
            || ((this.request.referer || '/login').endsWith('/login')
                ? this.url('homepage')
                : this.request.referer);
    }
}

class UserSudoHandler extends Handler {
    async get() {
        if (!this.session.sudoArgs?.method) throw new ForbiddenError();
        this.response.template = 'user_sudo.html';
    }

    @param('password', Types.String, true)
    @param('tfa', Types.String, true)
    @param('authnChallenge', Types.String, true)
    async post(domainId: string, password = '', tfa = '', authnChallenge = '') {
        if (!this.session.sudoArgs?.method) throw new ForbiddenError();
        await Promise.all([
            this.limitRate('user_sudo', 60, 5, true),
            oplog.log(this, 'user.sudo', {}),
        ]);
        if (this.user.authn && authnChallenge) {
            const challenge = await token.get(authnChallenge, token.TYPE_WEBAUTHN);
            if (challenge?.uid !== this.user._id) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_WEBAUTHN]);
            if (!challenge.verified) throw new ValidationError('challenge');
            await token.del(authnChallenge, token.TYPE_WEBAUTHN);
        } else if (this.user.tfa && tfa) {
            if (!verifyTFA(this.user._tfa, tfa)) throw new InvalidTokenError('2FA');
        } else this.user.checkPassword(password);
        this.session.sudo = Date.now();
        if (this.session.sudoArgs.method.toLowerCase() !== 'get') {
            this.response.template = 'user_sudo_redirect.html';
            this.response.body = this.session.sudoArgs;
        } else this.response.redirect = this.session.sudoArgs.redirect;
        this.session.sudoArgs.method = null;
    }
}

class UserWebauthnHandler extends Handler {
    noCheckPermView = true;

    @param('uname', Types.Username, true)
    async get(domainId: string, uname: string) {
        const udoc = this.user._id ? this.user : ((await user.getByEmail(domainId, uname)) || await user.getByUname(domainId, uname));
        if (!udoc._id) throw new UserNotFoundError(uname || 'user');
        if (!udoc.authn) throw new AuthOperationError('authn', 'disabled');
        const options = await generateAuthenticationOptions({
            allowCredentials: udoc._authenticators.map((authenticator) => ({
                id: authenticator.credentialID.buffer,
                type: 'public-key',
            })),
            userVerification: 'preferred',
        });
        await token.add(token.TYPE_WEBAUTHN, 60, { uid: udoc._id }, options.challenge);
        this.session.challenge = options.challenge;
        this.response.body.authOptions = options;
    }

    async post({ domainId, result }) {
        const challenge = this.session.challenge;
        if (!challenge) throw new ForbiddenError();
        const tdoc = await token.get(challenge, token.TYPE_WEBAUTHN);
        if (!tdoc) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_WEBAUTHN]);
        const udoc = await user.getById(domainId, tdoc.uid);
        const parseId = (id: Binary) => Buffer.from(id.toString('hex'), 'hex').toString('base64url');
        const authenticator = udoc._authenticators?.find((c) => parseId(c.credentialID) === result.id);
        if (!authenticator) throw new ValidationError('authenticator');
        const verification = await verifyAuthenticationResponse({
            response: result,
            expectedChallenge: challenge,
            expectedOrigin: this.request.headers.origin,
            expectedRPID: this.request.hostname,
            authenticator: {
                ...authenticator,
                credentialID: authenticator.credentialID.buffer,
                credentialPublicKey: authenticator.credentialPublicKey.buffer,
            },
        }).catch(() => null);
        if (!verification?.verified) throw new ValidationError('authenticator');
        authenticator.counter = verification.authenticationInfo.newCounter;
        await user.setById(udoc._id, { authenticators: udoc._authenticators });
        await token.update(challenge, token.TYPE_WEBAUTHN, 60, { verified: true });
        this.back();
    }
}

class UserLogoutHandler extends Handler {
    noCheckPermView = true;

    async get() {
        this.response.template = 'user_logout.html';
    }

    async post() {
        this.session.uid = 0;
        this.session.sudo = null;
        this.session.sudoUid = null;
        this.session.scope = PERM.PERM_ALL.toString();
        this.response.redirect = '/';
    }
}

export class UserRegisterHandler extends Handler {
    noCheckPermView = true;

    async get() {
        this.response.template = 'user_register.html';
    }

    @post('mail', Types.Email, true)
    @post('phone', Types.String, true, (s) => /^\d{11}$/.test(s))
    async post(domainId: string, mail: string, phoneNumber: string) {
        if (mail) {
            if (await user.getByEmail('system', mail)) throw new UserAlreadyExistError(mail);
            const mailDomain = mail.split('@')[1];
            if (await BlackListModel.get(`mail::${mailDomain}`)) throw new BlacklistedError(mailDomain);
            await Promise.all([
                this.limitRate(`send_mail_${mail}`, 60, 3, false),
                this.limitRate('send_mail', 3600, 30, false),
                oplog.log(this, 'user.register', {}),
            ]);
            const t = await token.add(
                token.TYPE_REGISTRATION,
                system.get('session.unsaved_expire_seconds'),
                { mail, redirect: this.domain.registerRedirect },
            );
            const prefix = this.domain.host
                ? `${this.domain.host instanceof Array ? this.domain.host[0] : this.domain.host}`
                : system.get('server.url');
            if (system.get('smtp.verify') && system.get('smtp.user')) {
                const m = await this.renderHTML('user_register_mail.html', {
                    path: `/register/${t[0]}`,
                    url_prefix: prefix.endsWith('/') ? prefix.slice(0, -1) : prefix,
                });
                await sendMail(mail, 'Sign Up', 'user_register_mail', m);
                this.response.template = 'user_register_mail_sent.html';
                this.response.body = { mail };
            } else this.response.redirect = this.url('user_register_with_code', { code: t[0] });
        } else if (phoneNumber) {
            if (!global.Hydro.lib.sendSms) throw new SystemError('Cannot send sms');
            await Promise.all([
                this.limitRate(`send_sms_${phoneNumber}`, 60, 1, false),
                this.limitRate('send_sms', 3600, 15, false),
                oplog.log(this, 'user.register', {}),
            ]);
            const id = String.random(6, '0123456789');
            await token.add(
                token.TYPE_REGISTRATION,
                10 * Time.minute,
                { phone: phoneNumber },
                id,
            );
            await global.Hydro.lib.sendSms(phoneNumber, 'register', id);
            this.response.body = { phone: phoneNumber };
            this.response.template = 'user_register_sms.html';
        } else throw new ValidationError('mail');
    }
}

class UserRegisterWithCodeHandler extends Handler {
    noCheckPermView = true;

    @param('code', Types.String)
    async get(domainId: string, code: string) {
        this.response.template = 'user_register_with_code.html';
        const tdoc = await token.get(code, token.TYPE_REGISTRATION);
        if (!tdoc) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_REGISTRATION], code);
        this.response.body = tdoc;
    }

    @param('password', Types.Password)
    @param('verifyPassword', Types.Password)
    @param('uname', Types.Username)
    @param('code', Types.String)
    async post(
        domainId: string, password: string, verify: string,
        uname: string, code: string,
    ) {
        const tdoc = await token.get(code, token.TYPE_REGISTRATION);
        if (!tdoc || (!tdoc.mail && !tdoc.phone)) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_REGISTRATION], code);
        if (password !== verify) throw new VerifyPasswordError();
        if (tdoc.phone) tdoc.mail = `${String.random(12)}@hydro.local`;
        const uid = await user.create(tdoc.mail, uname, password, undefined, this.request.ip);
        await token.del(code, token.TYPE_REGISTRATION);
        const [id, mailDomain] = tdoc.mail.split('@');
        const $set: any = tdoc.set || {};
        if (tdoc.phone) $set.phone = tdoc.phone;
        if (mailDomain === 'qq.com' && !Number.isNaN(+id)) $set.avatar = `qq:${id}`;
        if (this.session.viewLang) $set.viewLang = this.session.viewLang;
        if (Object.keys($set).length) await user.setById(uid, $set);
        if (tdoc.oauth) await oauth.set(tdoc.oauth[1], uid);
        this.session.viewLang = '';
        this.session.uid = uid;
        this.session.sudoUid = null;
        this.session.scope = PERM.PERM_ALL.toString();
        this.response.redirect = tdoc.redirect || this.url('home_settings', { category: 'preference' });
    }
}

class UserLostPassHandler extends Handler {
    noCheckPermView = true;

    async get() {
        this.response.template = 'user_lostpass.html';
    }

    @param('mail', Types.Email)
    async post(domainId: string, mail: string) {
        if (!system.get('smtp.user')) throw new SystemError('Cannot send mail');
        const udoc = await user.getByEmail('system', mail);
        if (!udoc) throw new UserNotFoundError(mail);
        await Promise.all([
            this.limitRate('send_mail', 3600, 30, false),
            this.limitRate(`user_lostpass_${mail}`, 60, 3, false),
            oplog.log(this, 'user.lostpass', {}),
        ]);
        const [tid] = await token.add(
            token.TYPE_LOSTPASS,
            system.get('session.unsaved_expire_seconds'),
            { uid: udoc._id },
        );
        const prefix = this.domain.host
            ? `${this.domain.host instanceof Array ? this.domain.host[0] : this.domain.host}`
            : system.get('server.url');
        const m = await this.renderHTML('user_lostpass_mail.html', {
            url: `/lostpass/${tid}`,
            url_prefix: prefix.endsWith('/') ? prefix.slice(0, -1) : prefix,
            uname: udoc.uname,
        });
        await sendMail(mail, 'Lost Password', 'user_lostpass_mail', m);
        this.response.template = 'user_lostpass_mail_sent.html';
    }
}

class UserLostPassWithCodeHandler extends Handler {
    noCheckPermView = true;

    async get({ domainId, code }) {
        const tdoc = await token.get(code, token.TYPE_LOSTPASS);
        if (!tdoc) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_LOSTPASS], code);
        const udoc = await user.getById(domainId, tdoc.uid);
        this.response.body = { uname: udoc.uname };
        this.response.template = 'user_lostpass_with_code.html';
    }

    @param('code', Types.String)
    @param('password', Types.Password)
    @param('verifyPassword', Types.Password)
    async post(domainId: string, code: string, password: string, verifyPassword: string) {
        const tdoc = await token.get(code, token.TYPE_LOSTPASS);
        if (!tdoc) throw new InvalidTokenError(token.TYPE_TEXTS[token.TYPE_LOSTPASS], code);
        if (password !== verifyPassword) throw new VerifyPasswordError();
        await user.setPassword(tdoc.uid, password);
        await token.del(code, token.TYPE_LOSTPASS);
        this.response.redirect = this.url('homepage');
    }
}

class UserDetailHandler extends Handler {
    @param('uid', Types.Int)
    async get(domainId: string, uid: number) {
        if (uid === 0) throw new UserNotFoundError(0);
        const isSelfProfile = this.user._id === uid;
        const [udoc, sdoc, union] = await Promise.all([
            user.getById(domainId, uid),
            token.getMostRecentSessionByUid(uid, ['createAt', 'updateAt']),
            domain.get(domainId),
        ]);
        if (!udoc) throw new UserNotFoundError(uid);
        const pdocs: ProblemDoc[] = [];
        const acInfo: Record<string, number> = {};
        const canViewHidden = this.user.hasPerm(PERM.PERM_VIEW_PROBLEM_HIDDEN) || this.user._id;
        if (this.user.hasPerm(PERM.PERM_VIEW_PROBLEM)) {
            await Promise.all([domainId, ...(union?.union || [])].map(async (did) => {
                const psdocs = await problem.getMultiStatus(did, { uid, status: STATUS.STATUS_ACCEPTED }).toArray();
                pdocs.push(...Object.values(
                    await problem.getList(
                        did, psdocs.map((i) => i.docId), canViewHidden,
                        false, problem.PROJECTION_LIST, true,
                    ),
                ));
            }));
        }
        for (const pdoc of pdocs) {
            for (const tag of pdoc.tag) {
                if (acInfo[tag]) acInfo[tag]++;
                else acInfo[tag] = 1;
            }
        }
        const tags = Object.entries(acInfo).sort((a, b) => b[1] - a[1]).slice(0, 20);
        const tsdocs = await ContestModel.getMultiStatus(domainId, { uid, attend: { $exists: true } }).project({ docId: 1 }).toArray();
        const tdocs = await ContestModel.getMulti(domainId, { docId: { $in: tsdocs.map((i) => i.docId) } })
            .project({ docId: 1, title: 1, rule: 1 }).sort({ _id: -1 }).toArray();
        this.response.template = 'user_detail.html';
        this.response.body = {
            isSelfProfile, udoc, sdoc, pdocs, tags, tdocs,
        };
        if (this.user.hasPerm(PERM.PERM_VIEW_PROBLEM_SOLUTION)) {
            const psdocs = await SolutionModel.getByUser(domainId, uid).limit(10).toArray();
            this.response.body.psdocs = psdocs;
            if (this.user.hasPerm(PERM.PERM_VIEW_PROBLEM)) {
                this.response.body.pdict = await problem.getList(
                    domainId, psdocs.map((i) => i.parentId), canViewHidden,
                    false, problem.PROJECTION_LIST,
                );
            }
        }
        this.UiContext.extraTitleContent = udoc.uname;
    }
}

class UserDeleteHandler extends Handler {
    async post({ password }) {
        this.user.checkPassword(password);
        const tid = await ScheduleModel.add({
            executeAfter: moment().add(7, 'days').toDate(),
            type: 'script',
            id: 'deleteUser',
            args: { uid: this.user._id },
        });
        await user.setById(this.user._id, { del: tid });
        this.response.template = 'user_delete_pending.html';
    }
}

class OauthHandler extends Handler {
    noCheckPermView = true;

    @param('type', Types.Key)
    async get(domainId: string, type: string) {
        await global.Hydro.module.oauth[type]?.get.call(this);
    }
}

class OauthCallbackHandler extends Handler {
    noCheckPermView = true;

    async get(args: any) {
        if (!global.Hydro.module.oauth[args.type]) throw new UserFacingError('Oauth type');
        const r = await global.Hydro.module.oauth[args.type].callback.call(this, args);
        const uid = await oauth.get(r._id);
        if (uid) {
            await user.setById(uid, { loginat: new Date(), loginip: this.request.ip });
            this.session.uid = uid;
            this.session.scope = PERM.PERM_ALL.toString();
            this.response.redirect = '/';
        } else {
            if (r.email) {
                const udoc = await user.getByEmail('system', r.email);
                if (udoc) {
                    await oauth.set(r._id, udoc._id);
                    await user.setById(udoc._id, { loginat: new Date(), loginip: this.request.ip });
                    this.session.uid = udoc._id;
                    this.session.scope = PERM.PERM_ALL.toString();
                    this.response.redirect = '/';
                    return;
                }
            }
            this.checkPriv(PRIV.PRIV_REGISTER_USER);
            let username = '';
            r.uname ||= [];
            const mailDomain = r.email.split('@')[1];
            if (await BlackListModel.get(`mail::${mailDomain}`)) throw new BlacklistedError(mailDomain);
            for (const uname of r.uname) {
                // eslint-disable-next-line no-await-in-loop
                const nudoc = await user.getByUname('system', uname);
                if (!nudoc) {
                    username = uname;
                    break;
                }
            }
            const set: Partial<Udoc> = { oauth: args.type };
            if (r.bio) set.bio = r.bio;
            if (r.viewLang) set.viewLang = r.viewLang;
            if (r.avatar) set.avatar = r.avatar;
            const [t] = await token.add(
                token.TYPE_REGISTRATION,
                system.get('session.unsaved_expire_seconds'),
                {
                    mail: r.email,
                    username,
                    redirect: this.domain.registerRedirect,
                    set,
                    oauth: [args.type, r._id],
                },
            );
            this.response.redirect = this.url('user_register_with_code', { code: t });
        }
    }
}

class ContestModeHandler extends Handler {
    async get() {
        const bindings = await user.getMulti({ loginip: { $exists: true } })
            .project<{ _id: number, loginip: string }>({ _id: 1, loginip: 1 }).toArray();
        this.response.body = { bindings };
        this.response.template = 'contest_mode.html';
    }

    @param('uid', Types.Int, true)
    async postReset(domainId: string, uid: number) {
        if (uid) await user.setById(uid, {}, { loginip: '' });
        else {
            await user.coll.updateMany({}, { $unset: { loginip: 1 } });
            deleteUserCache(true);
        }
    }
}

export async function apply(ctx) {
    ctx.Route('user_login', '/login', UserLoginHandler);
    ctx.Route('user_oauth', '/oauth/:type', OauthHandler);
    ctx.Route('user_sudo', '/user/sudo', UserSudoHandler, PRIV.PRIV_USER_PROFILE);
    ctx.Route('user_webauthn', '/user/webauthn', UserWebauthnHandler);
    ctx.Route('user_oauth_callback', '/oauth/:type/callback', OauthCallbackHandler);
    ctx.Route('user_register', '/register', UserRegisterHandler, PRIV.PRIV_REGISTER_USER);
    ctx.Route('user_register_with_code', '/register/:code', UserRegisterWithCodeHandler, PRIV.PRIV_REGISTER_USER);
    ctx.Route('user_logout', '/logout', UserLogoutHandler, PRIV.PRIV_USER_PROFILE);
    ctx.Route('user_lostpass', '/lostpass', UserLostPassHandler);
    ctx.Route('user_lostpass_with_code', '/lostpass/:code', UserLostPassWithCodeHandler);
    ctx.Route('user_delete', '/user/delete', UserDeleteHandler, PRIV.PRIV_USER_PROFILE);
    ctx.Route('user_detail', '/user/:uid(-?\\d+)', UserDetailHandler);
    if (system.get('server.contestmode')) {
        ctx.Route('contest_mode', '/contestmode', ContestModeHandler, PRIV.PRIV_EDIT_SYSTEM);
    }
}
