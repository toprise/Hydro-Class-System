import crypto from 'crypto';
import {
    Context, md5, Schema, sha1,
} from 'hydrooj';

const RE_MD5 = /^[\da-f]{32}$/;

export function apply(ctx: Context) {
    ctx.addScript(
        'migrateHustoj', 'migrate from hustoj',
        Schema.object({
            host: Schema.string().required(),
            port: Schema.number().required(),
            name: Schema.string().required(),
            username: Schema.string().required(),
            password: Schema.string().required(),
            domainId: Schema.string().required(),
            contestType: Schema.string().required(),
            dataDir: Schema.string().required(),
            uploadDir: Schema.string().default('/home/judge/src/web/upload/'),
        }),
        (...args) => require('./scripts/hustoj').run(...args),
    );
    ctx.addScript(
        'migrateSyzoj', 'migrate from syzoj',
        Schema.object({
            host: Schema.string().default('localhost'),
            port: Schema.number().default(3306),
            name: Schema.string().default('syzoj'),
            username: Schema.string().required(),
            password: Schema.string().required(),
            domainId: Schema.string().default('system'),
            dataDir: Schema.string().default('/opt/syzoj/web/uploads'),
        }),
        (...args) => require('./scripts/syzoj').run(...args),
    );
    ctx.addScript(
        'migrateVijos', 'migrate from vijos',
        Schema.object({
            host: Schema.string().required(),
            port: Schema.number().required(),
            name: Schema.string().required(),
            username: Schema.string().required(),
            password: Schema.string().required(),
        }),
        (...args) => require('./scripts/vijos').run(...args),
    );
    ctx.addScript(
        'migrateuniversaloj', 'migrate from universaloj',
        Schema.object({
            host: Schema.string().default('172.17.0.2'),
            port: Schema.number().default(3306),
            name: Schema.string().default('app_uoj233'),
            username: Schema.string().default('hydromigrate'),
            password: Schema.string().required(),
            domainId: Schema.string().default('system'),
            dataDir: Schema.string().required(),
        }),
        (...args) => require('./scripts/universaloj').run(...args),
    );

    ctx.provideModule('hash', 'hust', ($password, $saved) => {
        $password = md5($password);
        if (RE_MD5.test($saved)) return $password === $saved;
        const $svd = Buffer.from($saved, 'base64').toString('hex');
        const $salt = Buffer.from($svd.substr(40), 'hex').toString();
        const $hash = Buffer.concat([
            Buffer.from(sha1($password + $salt), 'hex'),
            Buffer.from($salt),
        ]).toString('base64');
        if ($hash.trim() === $saved.trim()) return true;
        return false;
    });
    ctx.provideModule('hash', 'vj2', (password, salt, { uname }) => {
        const pmd5 = md5(password);
        const mixedSha1 = sha1(md5(uname.toLowerCase() + pmd5) + salt + sha1(pmd5 + salt));
        return `${Buffer.from(uname).toString('base64')}|${mixedSha1}`;
    });
    ctx.provideModule('hash', 'syzoj', (password: string) => md5(`${password}syzoj2_xxx`));
    ctx.provideModule('hash', 'uoj', (password, salt, { uname }) => md5(`${uname}${crypto.createHmac('md5', salt).update(password).digest('hex')}`));

    ctx.i18n.load('zh', {
        'migrate from hustoj': '从 HustOJ 导入',
        'migrate from vijos': '从 Vijos 导入',
        'migrate from syzoj': '从 SYZOJ 导入',
        'migrate from universaloj': '从 UniversalOJ 导入',
    });
}
