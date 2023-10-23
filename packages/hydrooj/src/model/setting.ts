/* eslint-disable max-len */
/* eslint-disable no-await-in-loop */
import cordis from 'cordis';
import yaml from 'js-yaml';
import { Dictionary } from 'lodash';
import moment from 'moment-timezone';
import { LangConfig, parseLang } from '@hydrooj/utils/lib/lang';
import { retry } from '@hydrooj/utils/lib/utils';
import { Context, Service } from '../context';
import { Setting as _Setting } from '../interface';
import { Logger } from '../logger';
import * as builtin from './builtin';

type SettingDict = Dictionary<_Setting>;

const logger = new Logger('model/setting');
const countries = moment.tz.countries();
const tzs = new Set();
for (const country of countries) {
    const tz = moment.tz.zonesForCountry(country);
    for (const t of tz) tzs.add(t);
}
const timezones = Array.from(tzs).sort().map((tz) => [tz, tz]) as [string, string][];
const langRange: Dictionary<string> = {};

for (const lang in global.Hydro.locales) {
    langRange[lang] = global.Hydro.locales[lang].__langname;
}

export const FLAG_HIDDEN = 1;
export const FLAG_DISABLED = 2;
export const FLAG_SECRET = 4;
export const FLAG_PRO = 8;

export const PREFERENCE_SETTINGS: _Setting[] = [];
export const ACCOUNT_SETTINGS: _Setting[] = [];
export const DOMAIN_SETTINGS: _Setting[] = [];
export const DOMAIN_USER_SETTINGS: _Setting[] = [];
export const SYSTEM_SETTINGS: _Setting[] = [];
export const SETTINGS: _Setting[] = [];
export const SETTINGS_BY_KEY: SettingDict = {};
export const DOMAIN_USER_SETTINGS_BY_KEY: SettingDict = {};
export const DOMAIN_SETTINGS_BY_KEY: SettingDict = {};
export const SYSTEM_SETTINGS_BY_KEY: SettingDict = {};

// eslint-disable-next-line max-len
export type SettingType = 'text' | 'yaml' | 'number' | 'float' | 'markdown' | 'password' | 'boolean' | 'textarea' | [string, string][] | Record<string, string> | 'json';

export const Setting = (
    family: string, key: string, value: any = null,
    type: SettingType = 'text', name = '', desc = '', flag = 0,
): _Setting => {
    let subType = '';
    if (type === 'yaml' && typeof value !== 'string') {
        value = yaml.dump(value);
        type = 'textarea';
        subType = 'yaml';
    }
    return {
        family,
        key,
        value,
        name,
        desc,
        flag,
        subType,
        type: typeof type === 'object' ? 'select' : type,
        range: typeof type === 'object' ? type : null,
    };
};

export const PreferenceSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        if (PREFERENCE_SETTINGS.find((s) => s.key === setting.key)) logger.warn(`Duplicate setting key: ${setting.key}`);
        PREFERENCE_SETTINGS.push(setting);
        SETTINGS.push(setting);
        SETTINGS_BY_KEY[setting.key] = setting;
    }
    return () => {
        for (const setting of settings) {
            delete SETTINGS_BY_KEY[setting.key];
            if (PREFERENCE_SETTINGS.includes(setting)) {
                PREFERENCE_SETTINGS.splice(PREFERENCE_SETTINGS.indexOf(setting), 1);
            }
            if (SETTINGS.includes(setting)) {
                SETTINGS.splice(SETTINGS.indexOf(setting), 1);
            }
        }
    };
};
export const AccountSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        if (ACCOUNT_SETTINGS.find((s) => s.key === setting.key)) logger.warn(`Duplicate setting key: ${setting.key}`);
        ACCOUNT_SETTINGS.push(setting);
        SETTINGS.push(setting);
        SETTINGS_BY_KEY[setting.key] = setting;
    }
    return () => {
        for (const setting of settings) {
            delete SETTINGS_BY_KEY[setting.key];
            if (ACCOUNT_SETTINGS.includes(setting)) {
                ACCOUNT_SETTINGS.splice(ACCOUNT_SETTINGS.indexOf(setting), 1);
            }
            if (SETTINGS.includes(setting)) {
                SETTINGS.splice(SETTINGS.indexOf(setting), 1);
            }
        }
    };
};
export const DomainUserSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        if (DOMAIN_USER_SETTINGS.find((s) => s.key === setting.key)) logger.warn(`Duplicate setting key: ${setting.key}`);
        DOMAIN_USER_SETTINGS.push(setting);
        DOMAIN_USER_SETTINGS_BY_KEY[setting.key] = setting;
    }
    return () => {
        for (const setting of settings) {
            delete DOMAIN_USER_SETTINGS_BY_KEY[setting.key];
            if (DOMAIN_USER_SETTINGS.includes(setting)) {
                DOMAIN_USER_SETTINGS.splice(DOMAIN_USER_SETTINGS.indexOf(setting), 1);
            }
        }
    };
};
export const DomainSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        if (DOMAIN_SETTINGS.find((s) => s.key === setting.key)) logger.warn(`Duplicate setting key: ${setting.key}`);
        DOMAIN_SETTINGS.push(setting);
        DOMAIN_SETTINGS_BY_KEY[setting.key] = setting;
    }
    return () => {
        for (const setting of settings) {
            delete DOMAIN_SETTINGS_BY_KEY[setting.key];
            if (DOMAIN_SETTINGS.includes(setting)) {
                DOMAIN_SETTINGS.splice(DOMAIN_SETTINGS.indexOf(setting), 1);
            }
        }
    };
};
export const SystemSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        if (SYSTEM_SETTINGS.find((s) => s.key === setting.key)) logger.warn(`Duplicate setting key: ${setting.key}`);
        SYSTEM_SETTINGS.push(setting);
        SYSTEM_SETTINGS_BY_KEY[setting.key] = setting;
    }
    return () => {
        for (const setting of settings) {
            delete SYSTEM_SETTINGS_BY_KEY[setting.key];
            if (SYSTEM_SETTINGS.includes(setting)) {
                SYSTEM_SETTINGS.splice(SYSTEM_SETTINGS.indexOf(setting), 1);
            }
        }
    };
};

const LangSettingNode = {
    family: 'setting_usage',
    key: 'codeLang',
    value: '',
    name: 'codeLang',
    desc: 'Default Code Language',
    flag: 0,
    subType: '',
    type: 'select',
    range: {},
};
const ServerLangSettingNode = {
    family: 'setting_server',
    key: 'preference.codeLang',
    value: '',
    name: 'preference.codeLang',
    desc: 'Default Code Language',
    flag: 0,
    subType: '',
    type: 'select',
    range: {},
};

PreferenceSetting(
    Setting('setting_display', 'viewLang', null, langRange, 'UI Language'),
    Setting('setting_display', 'skipAnimate', false, 'boolean', 'Skip Animation'),
    Setting('setting_display', 'timeZone', 'Asia/Shanghai', timezones, 'Timezone'),
    LangSettingNode,
    Setting('setting_usage', 'codeTemplate', '', 'textarea', 'Default Code Template',
        'If left blank, the built-in template of the corresponding language will be used.'),
);

AccountSetting(
    Setting('setting_info', 'avatar', '', 'text', 'Avatar',
        'Allow using gravatar:email qq:id github:name url:link format.'),
    Setting('setting_info', 'qq', null, 'text', 'QQ'),
    Setting('setting_info', 'gender', builtin.USER_GENDER_OTHER, builtin.USER_GENDER_RANGE, 'Gender'),
    Setting('setting_info', 'bio', null, 'markdown', 'Bio'),
    Setting('setting_info', 'school', '', 'text', 'School'),
    Setting('setting_info', 'studentId', '', 'text', 'Student ID'),
    Setting('setting_info', 'phone', null, 'text', 'Phone', null, FLAG_DISABLED),
    Setting('setting_customize', 'backgroundImage',
        '/components/profile/backgrounds/1.jpg', 'text', 'Profile Background Image',
        'Choose the background image in your profile page.'),
    Setting('setting_storage', 'unreadMsg', 0, 'number', 'Unread Message Count', null, FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'badge', '', 'text', 'badge info', null, FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'banReason', '', 'text', 'ban reason', null, FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'pinnedDomains', [], 'json', 'pinned domains', null, FLAG_DISABLED | FLAG_HIDDEN),
);

DomainSetting(
    Setting('setting_domain', 'name', 'New domain', 'text', 'name'),
    Setting('setting_domain', 'avatar', '', 'text', 'avatar', 'Will be used as the domain icon.'),
    Setting('setting_domain', 'share', '', 'text', 'Share problem with domain (* for any)'),
    Setting('setting_domain', 'bulletin', '', 'markdown', 'Bulletin'),
    Setting('setting_domain', 'langs', '', 'text', 'Allowed langs', null),
    Setting('setting_storage', 'host', '', 'text', 'Custom host', null, FLAG_HIDDEN | FLAG_DISABLED),
);

DomainUserSetting(
    Setting('setting_info', 'displayName', '', 'text', 'Display Name'),
    Setting('setting_storage', 'nAccept', 0, 'number', 'nAccept', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'nSubmit', 0, 'number', 'nSubmit', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'nLike', 0, 'number', 'nLike', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rp', 0, 'number', 'RP', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rpInfo', {}, 'json', 'RP Detail', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rpdelta', 0, 'number', 'RP.delta', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rank', 0, 'number', 'Rank', null, FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'level', 0, 'number', 'level', null, FLAG_HIDDEN | FLAG_DISABLED),
);

const ignoreUA = [
    'bingbot',
    'Gatus',
    'Googlebot',
    'Prometheus',
    'Uptime',
    'YandexBot',
].join('\n');

SystemSetting(
    Setting('setting_smtp', 'smtp.user', null, 'text', 'smtp.user', 'SMTP Username'),
    Setting('setting_smtp', 'smtp.pass', null, 'password', 'smtp.pass', 'SMTP Password', FLAG_SECRET),
    Setting('setting_smtp', 'smtp.host', null, 'text', 'smtp.host', 'SMTP Server Host'),
    Setting('setting_smtp', 'smtp.port', 465, 'number', 'smtp.port', 'SMTP Server Port'),
    Setting('setting_smtp', 'smtp.from', null, 'text', 'smtp.from', 'Mail From'),
    Setting('setting_smtp', 'smtp.secure', false, 'boolean', 'smtp.secure', 'SSL'),
    Setting('setting_smtp', 'smtp.verify', true, 'boolean', 'smtp.verify', 'Verify register email'),
    Setting('setting_server', 'server.center', 'https://hydro.ac/center', 'text', 'server.center', '', FLAG_HIDDEN),
    Setting('setting_server', 'server.name', 'Hydro', 'text', 'server.name', 'Server Name'),
    Setting('setting_server', 'server.displayName', 'Hydro', 'text', 'server.name', 'Server Name (Global Display)', FLAG_PRO),
    Setting('setting_server', 'server.url', '/', 'text', 'server.url', 'Server BaseURL'),
    Setting('setting_server', 'server.upload', '256m', 'text', 'server.upload', 'Max upload file size'),
    Setting('setting_server', 'server.cdn', '/', 'text', 'server.cdn', 'CDN Prefix'),
    Setting('setting_server', 'server.ws', '/', 'text', 'server.ws', 'WebSocket Prefix'),
    Setting('setting_server', 'server.port', 8888, 'number', 'server.port', 'Server Port'),
    Setting('setting_server', 'server.xff', null, 'text', 'server.xff', 'IP Header'),
    Setting('setting_server', 'server.xhost', null, 'text', 'server.xhost', 'Hostname Header'),
    Setting('setting_server', 'server.xproxy', false, 'boolean', 'server.xproxy', 'Use reverse_proxy'),
    Setting('setting_server', 'server.cors', '', 'text', 'server.cors', 'CORS domains'),
    Setting('setting_server', 'server.language', 'zh_CN', langRange, 'server.language', 'Default display language'),
    Setting('setting_server', 'server.login', true, 'boolean', 'server.login', 'Allow builtin-login', FLAG_PRO),
    Setting('setting_server', 'server.message', true, 'boolean', 'server.message', 'Allow users send messages'),
    Setting('setting_server', 'server.checkUpdate', true, 'boolean', 'server.checkUpdate', 'Daily update check'),
    Setting('setting_server', 'server.ignoreUA', ignoreUA, 'textarea', 'server.ignoreUA', 'ignoredUA'),
    ServerLangSettingNode,
    Setting('setting_limits', 'limit.by_user', false, 'boolean', 'limit.by_user', 'Use per-user limits instead of per ip limits'),
    Setting('setting_limits', 'limit.problem_files_max', 100, 'number', 'limit.problem_files_max', 'Max files per problem'),
    Setting('setting_limits', 'limit.problem_files_max_size', 256 * 1024 * 1024, 'number', 'limit.problem_files_max_size', 'Max files size per problem'),
    Setting('setting_limits', 'limit.user_files', 100, 'number', 'limit.user_files', 'Max files for user'),
    Setting('setting_limits', 'limit.user_files_size', 128 * 1024 * 1024, 'number', 'limit.user_files_size', 'Max total file size for user'),
    Setting('setting_limits', 'limit.contest_files', 100, 'number', 'limit.contest_files', 'Max files for contest or training'),
    Setting('setting_limits', 'limit.contest_files_size', 128 * 1024 * 1024, 'number', 'limit.contest_files_size', 'Max total file size for contest or training'),
    Setting('setting_limits', 'limit.submission', 60, 'number', 'limit.submission', 'Max submission count per minute'),
    Setting('setting_limits', 'limit.submission_user', 15, 'number', 'limit.submission_user', 'Max submission count per user per minute'),
    Setting('setting_limits', 'limit.pretest', 60, 'number', 'limit.pretest', 'Max pretest count per minute'),
    Setting('setting_basic', 'avatar.gravatar_url', '//cn.gravatar.com/avatar/', 'text', 'avatar.gravatar_url', 'Gravatar URL Prefix'),
    Setting('setting_basic', 'default.priv', builtin.PRIV.PRIV_DEFAULT, 'number', 'default.priv', 'Default Privilege', FLAG_HIDDEN),
    Setting('setting_basic', 'discussion.nodes', builtin.DEFAULT_NODES, 'yaml', 'discussion.nodes', 'Discussion Nodes'),
    Setting('setting_basic', 'problem.categories', builtin.CATEGORIES, 'yaml', 'problem.categories', 'Problem Categories'),
    Setting('setting_basic', 'pagination.problem', 100, 'number', 'pagination.problem', 'Problems per page'),
    Setting('setting_basic', 'pagination.contest', 20, 'number', 'pagination.contest', 'Contests per page'),
    Setting('setting_basic', 'pagination.discussion', 50, 'number', 'pagination.discussion', 'Discussions per page'),
    Setting('setting_basic', 'pagination.record', 100, 'number', 'pagination.record', 'Records per page'),
    Setting('setting_basic', 'pagination.solution', 20, 'number', 'pagination.solution', 'Solutions per page'),
    Setting('setting_basic', 'pagination.training', 10, 'number', 'pagination.training', 'Trainings per page'),
    Setting('setting_basic', 'pagination.reply', 50, 'number', 'pagination.reply', 'Replies per page'),
    Setting('setting_session', 'session.keys', [String.random(32)], 'text', 'session.keys', 'session.keys', FLAG_HIDDEN),
    Setting('setting_session', 'session.domain', '', 'text', 'session.domain', 'session.domain', FLAG_HIDDEN),
    Setting('setting_session', 'session.saved_expire_seconds', 3600 * 24 * 30,
        'number', 'session.saved_expire_seconds', 'Saved session expire seconds'),
    Setting('setting_session', 'session.unsaved_expire_seconds', 3600 * 3,
        'number', 'session.unsaved_expire_seconds', 'Unsaved session expire seconds'),
    Setting('setting_storage', 'db.ver', 0, 'number', 'db.ver', 'Database version', FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'installid', String.random(64), 'text', 'installid', 'Installation ID', FLAG_HIDDEN | FLAG_DISABLED),
);

// eslint-disable-next-line import/no-mutable-exports
export const langs: Record<string, LangConfig> = {};

declare module '../context' {
    interface Context {
        setting: SettingService;
    }
}

const T = <F extends (...args: any[]) => any>(origFunc: F, disposeFunc?) =>
    function method(this: cordis.Service, ...args: Parameters<F>) {
        const res = origFunc(...args);
        this.caller?.on('dispose', () => (disposeFunc ? disposeFunc(res) : res()));
    };

export class SettingService extends Service {
    static readonly methods = ['PreferenceSetting', 'AccountSetting', 'DomainSetting', 'DomainUserSetting', 'SystemSetting'];
    PreferenceSetting = T(PreferenceSetting);
    AccountSetting = T(AccountSetting);
    DomainSetting = T(DomainSetting);
    DomainUserSetting = T(DomainUserSetting);
    SystemSetting = T(SystemSetting);
    constructor(ctx: Context) {
        super(ctx, 'setting', true);
    }
}

export async function apply(ctx: Context) {
    Context.service('setting', SettingService);
    ctx.setting = new SettingService(ctx);
    logger.info('Ensuring settings');
    const system = global.Hydro.model.system;
    for (const setting of SYSTEM_SETTINGS) {
        if (!setting.value) continue;
        const current = await global.Hydro.service.db.collection('system').findOne({ _id: setting.key });
        if (!current || current.value == null || current.value === '') {
            await retry(system.set, setting.key, setting.value);
        }
    }
    try {
        Object.assign(langs, parseLang(system.get('hydrooj.langs')));
        const range = {};
        for (const key in langs) range[key] = langs[key].display;
        LangSettingNode.range = range;
        ServerLangSettingNode.range = range;
    } catch (e) { /* Ignore */ }
    ctx.on('system/setting', (args) => {
        if (!args.hydrooj?.langs) return;
        Object.assign(langs, parseLang(args.hydrooj.langs));
        const range = {};
        for (const key in langs) range[key] = langs[key].display;
        LangSettingNode.range = range;
        ServerLangSettingNode.range = range;
    });
}

global.Hydro.model.setting = {
    apply,
    SettingService,
    Setting,
    PreferenceSetting,
    AccountSetting,
    DomainSetting,
    DomainUserSetting,
    SystemSetting,
    FLAG_HIDDEN,
    FLAG_DISABLED,
    FLAG_SECRET,
    FLAG_PRO,
    PREFERENCE_SETTINGS,
    ACCOUNT_SETTINGS,
    SETTINGS,
    SETTINGS_BY_KEY,
    SYSTEM_SETTINGS,
    SYSTEM_SETTINGS_BY_KEY,
    DOMAIN_SETTINGS,
    DOMAIN_SETTINGS_BY_KEY,
    DOMAIN_USER_SETTINGS,
    DOMAIN_USER_SETTINGS_BY_KEY,
    langs,
};
