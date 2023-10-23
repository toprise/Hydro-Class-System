/* eslint-disable no-await-in-loop */
import type {
    Db, Filter, ObjectId, OnlyFieldsOfType,
} from 'mongodb';
import pm2 from '@hydrooj/utils/lib/locate-pm2';
import type { ProblemSolutionHandler } from '../handler/problem';
import type { UserRegisterHandler } from '../handler/user';
import type {
    BaseUserDict, DiscussionDoc, DomainDoc, FileInfo,
    MessageDoc, ProblemDict, ProblemDoc, RecordDoc,
    ScoreboardRow, Tdoc, TrainingDoc, User,
} from '../interface';
import type { DocType } from '../model/document';
import type { ConnectionHandler, Handler } from './server';

export type Disposable = () => void;
export type VoidReturn = Promise<any> | any;
type HookType = 'before-prepare' | 'before' | 'before-operation' | 'after' | 'finish';
type ModuleCategories = 'lib' | 'locale' | 'template' | 'script' | 'model' | 'setting' | 'handler' | 'service' | 'addon';
type LifecycleEvents = Record<`app/load/${ModuleCategories}`, () => VoidReturn>;
type MapHandlerEvents<N extends string, H extends Handler> = Record<`handler/${HookType}/${N}`, (thisArg: H) => VoidReturn>;
type KnownHandlerEvents =
    MapHandlerEvents<'UserRegister', UserRegisterHandler>
    & MapHandlerEvents<'ProblemSolution', ProblemSolutionHandler>;
type HandlerEvents =
    KnownHandlerEvents
    & Record<`handler/${HookType}/${string}`, (thisArg: Handler & Record<string, any>) => VoidReturn>
    & Record<`handler/${HookType}`, (thisArg: Handler) => VoidReturn>
    & Record<`handler/register/${string}`, (HandlerClass: typeof Handler) => VoidReturn>
    & Record<`connection/${'create' | 'active' | 'close'}`, (thisArg: ConnectionHandler) => VoidReturn>;

/* eslint-disable @typescript-eslint/naming-convention */
export interface EventMap extends LifecycleEvents, HandlerEvents {
    'app/started': () => void
    'app/listen': () => void
    'app/ready': () => VoidReturn
    'app/exit': () => VoidReturn
    'app/before-reload': (entries: Set<string>) => VoidReturn
    'app/reload': (entries: Set<string>) => VoidReturn

    'app/watch/change': (path: string) => VoidReturn
    'app/watch/unlink': (path: string) => VoidReturn

    'database/connect': (db: Db) => void
    'database/config': () => VoidReturn

    'system/setting': (args: Record<string, any>) => VoidReturn
    'bus/broadcast': (event: keyof EventMap, ...args: any[]) => VoidReturn
    'monitor/update': (type: 'server' | 'judge', $set: any) => VoidReturn
    'api/update': () => void;
    'task/daily': () => void;

    'user/message': (uid: number, mdoc: MessageDoc) => void
    'user/get': (udoc: User) => void
    'user/delcache': (content: string | true) => void

    'domain/create': (ddoc: DomainDoc) => VoidReturn
    'domain/before-get': (query: Filter<DomainDoc>) => VoidReturn
    'domain/get': (ddoc: DomainDoc) => VoidReturn
    'domain/before-update': (domainId: string, $set: Partial<DomainDoc>) => VoidReturn
    'domain/update': (domainId: string, $set: Partial<DomainDoc>, ddoc: DomainDoc) => VoidReturn
    'domain/delete': (domainId: string) => VoidReturn
    'domain/delete-cache': (domainId: string) => VoidReturn

    'document/add': (doc: any) => VoidReturn
    'document/set': <T extends keyof DocType>(
        domainId: string, docType: T, docId: DocType[T],
        $set: any, $unset: OnlyFieldsOfType<DocType[T], any, true | '' | 1>
    ) => VoidReturn

    'handler/create': (thisArg: Handler) => VoidReturn
    'handler/init': (thisArg: Handler) => VoidReturn
    'handler/error': (thisArg: Handler, e: Error) => VoidReturn

    'discussion/before-add': (payload: Partial<DiscussionDoc>) => VoidReturn
    'discussion/add': (payload: Partial<DiscussionDoc>) => VoidReturn

    'problem/before-add': (domainId: string, content: string, owner: number, docId: number, doc: Partial<ProblemDoc>) => VoidReturn
    'problem/add': (doc: Partial<ProblemDoc>, docId: number) => VoidReturn
    'problem/before-edit': (doc: Partial<ProblemDoc>) => VoidReturn
    'problem/edit': (doc: ProblemDoc) => VoidReturn
    'problem/before-del': (domainId: string, docId: number) => VoidReturn
    'problem/del': (domainId: string, docId: number) => VoidReturn
    'problem/list': (query: Filter<ProblemDoc>, handler: any) => VoidReturn
    'problem/get': (doc: ProblemDoc, handler: any) => VoidReturn
    'problem/delete': (domainId: string, docId: number) => VoidReturn
    'problem/addTestdata': (domainId: string, docId: number, name: string, payload: Omit<FileInfo, '_id'>) => VoidReturn
    'problem/delTestdata': (domainId: string, docId: number, name: string[]) => VoidReturn
    'problem/addAdditionalFile': (domainId: string, docId: number, name: string, payload: Omit<FileInfo, '_id'>) => VoidReturn
    'problem/delAdditionalFile': (domainId: string, docId: number, name: string[]) => VoidReturn

    'contest/before-add': (payload: Partial<Tdoc<30>>) => VoidReturn
    'contest/add': (payload: Partial<Tdoc<30>>, id: ObjectId) => VoidReturn
    'contest/scoreboard': (tdoc: Tdoc<30>, rows: ScoreboardRow[], udict: BaseUserDict, pdict: ProblemDict) => VoidReturn

    'oplog/log': (type: string, handler: Handler, args: any, data: any) => VoidReturn;

    'training/list': (query: Filter<TrainingDoc>, handler: any) => VoidReturn
    'training/get': (tdoc: TrainingDoc, handler: any) => VoidReturn

    'record/change': (rdoc: RecordDoc, $set?: any, $push?: any, body?: any) => void
    'record/judge': (rdoc: RecordDoc, updated: boolean) => VoidReturn
}
/* eslint-enable @typescript-eslint/naming-convention */

try {
    if (!process.send || !pm2 || process.env.exec_mode !== 'cluster_mode') throw new Error();
    pm2.launchBus((err, bus) => {
        if (err) throw new Error();
        bus.on('hydro:broadcast', (packet) => {
            (app.parallel as any)(packet.data.event, ...packet.data.payload);
        });
        app.on('bus/broadcast', (event, payload) => {
            process.send({ type: 'hydro:broadcast', data: { event, payload } });
        });
        console.debug('Using pm2 event bus');
    });
} catch (e) {
    app.on('bus/broadcast', (event, payload) => app.parallel(event, ...payload));
    console.debug('Using mongodb external event bus');
}

export default app;
export const on = (a, b, c?) => app.on(a, b, c);
export const off = (a, b) => app.off(a, b);
export const once = (a, b, c?) => app.once(a, b, c);
export const parallel = app.parallel.bind(app);
export const emit = app.parallel.bind(app);
export const bail = app.bail.bind(app);
// For backward compatibility
export const serial: any = app.parallel.bind(app);
export const broadcast = app.broadcast.bind(app);

global.Hydro.service.bus = app as any;
global.bus = app;
