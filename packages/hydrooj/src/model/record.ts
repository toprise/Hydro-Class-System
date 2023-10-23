/* eslint-disable object-curly-newline */
import { sum } from 'lodash';
import moment from 'moment-timezone';
import {
    Filter, MatchKeysAndValues,
    ObjectId, OnlyFieldsOfType, PushOperator, UpdateFilter,
} from 'mongodb';
import { Context } from '../context';
import { ProblemNotFoundError } from '../error';
import {
    JudgeMeta, ProblemConfigFile, RecordDoc,
} from '../interface';
import db from '../service/db';
import { MaybeArray, NumberKeys } from '../typeutils';
import { ArgMethod, buildProjection, Time } from '../utils';
import { STATUS } from './builtin';
import problem from './problem';
import task from './task';

export default class RecordModel {
    static coll = db.collection('record');
    static PROJECTION_LIST: (keyof RecordDoc)[] = [
        '_id', 'score', 'time', 'memory', 'lang',
        'uid', 'pid', 'rejudged', 'progress', 'domainId',
        'contest', 'judger', 'judgeAt', 'status', 'source',
        'files',
    ];

    static async submissionPriority(uid: number, base: number = 0) {
        const timeRecent = await RecordModel.coll
            .find({ _id: { $gte: Time.getObjectID(moment().add(-30, 'minutes')) }, uid, rejudged: { $ne: true } })
            .project({ time: 1, status: 1 }).toArray();
        const pending = timeRecent.filter((i) => [
            STATUS.STATUS_WAITING, STATUS.STATUS_FETCHED, STATUS.STATUS_COMPILING, STATUS.STATUS_JUDGING,
        ].includes(i.status)).length;
        return Math.max(base - 10000, base - (pending * 1000 + 1) * (sum(timeRecent.map((i) => i.time || 0)) / 10000 + 1));
    }

    static async get(_id: ObjectId): Promise<RecordDoc | null>;
    static async get(domainId: string, _id: ObjectId): Promise<RecordDoc | null>;
    static async get(arg0: string | ObjectId, arg1?: any) {
        const _id = arg1 || arg0;
        const domainId = arg1 ? arg0 : null;
        const res = await RecordModel.coll.findOne({ _id });
        if (!res) return null;
        if (res.domainId === (domainId || res.domainId)) return res;
        return null;
    }

    @ArgMethod
    static async stat(domainId?: string) {
        const [d5min, d1h, day, week, month, year, total] = await Promise.all([
            RecordModel.coll.countDocuments({ _id: { $gte: Time.getObjectID(moment().add(-5, 'minutes')) }, ...domainId ? { domainId } : {} }),
            RecordModel.coll.countDocuments({ _id: { $gte: Time.getObjectID(moment().add(-1, 'hour')) }, ...domainId ? { domainId } : {} }),
            RecordModel.coll.countDocuments({ _id: { $gte: Time.getObjectID(moment().add(-1, 'day')) }, ...domainId ? { domainId } : {} }),
            RecordModel.coll.countDocuments({ _id: { $gte: Time.getObjectID(moment().add(-1, 'week')) }, ...domainId ? { domainId } : {} }),
            RecordModel.coll.countDocuments({ _id: { $gte: Time.getObjectID(moment().add(-1, 'month')) }, ...domainId ? { domainId } : {} }),
            RecordModel.coll.countDocuments({ _id: { $gte: Time.getObjectID(moment().add(-1, 'year')) }, ...domainId ? { domainId } : {} }),
            RecordModel.coll.countDocuments(domainId ? { domainId } : {}),
        ]);
        return {
            d5min, d1h, day, week, month, year, total,
        };
    }

    static async judge(domainId: string, rids: MaybeArray<ObjectId>, priority = 0, config: ProblemConfigFile = {}, meta: Partial<JudgeMeta> = {}) {
        rids = rids instanceof Array ? rids : [rids];
        if (!rids.length) return null;
        const rdoc = await RecordModel.get(domainId, rids[0]);
        if (!rdoc) return null;
        let source = `${domainId}/${rdoc.pid}`;
        await task.deleteMany({ rid: { $in: rids } });
        let pdoc = await problem.get(rdoc.domainId, rdoc.pid);
        if (!pdoc) throw new ProblemNotFoundError(rdoc.domainId, rdoc.pid);
        if (pdoc.reference) {
            pdoc = await problem.get(pdoc.reference.domainId, pdoc.reference.pid);
            if (!pdoc) throw new ProblemNotFoundError(rdoc.domainId, rdoc.pid);
            source = `${pdoc.domainId}/${pdoc.docId}`;
        }
        meta = { ...meta, problemOwner: pdoc.owner };
        if (typeof pdoc.config === 'string') throw new Error(pdoc.config);
        const type = (pdoc.config.type === 'remote_judge' && rdoc.contest?.toHexString() !== '0'.repeat(24)) ? 'remotejudge' : 'judge';
        config.type = pdoc.config.type === 'fileio' ? 'default' : pdoc.config.type as any;
        return await task.addMany(rids.map((rid) => ({
            ...(pdoc.config as any),
            priority,
            type,
            rid,
            domainId,
            config,
            data: pdoc.data,
            source,
            meta,
        } as any)));
    }

    static async add(
        domainId: string, pid: number, uid: number,
        lang: string, code: string, addTask: boolean,
        args: {
            contest?: ObjectId,
            input?: string,
            files?: Record<string, string>,
            type: 'judge' | 'rejudge' | 'contest' | 'pretest' | 'hack',
        } = { type: 'judge' },
    ) {
        const data: RecordDoc = {
            status: STATUS.STATUS_WAITING,
            _id: new ObjectId(),
            uid,
            code,
            lang,
            pid,
            domainId,
            score: 0,
            time: 0,
            memory: 0,
            judgeTexts: [],
            compilerTexts: [],
            testCases: [],
            judger: null,
            judgeAt: null,
            rejudged: false,
        };
        if (args.contest) data.contest = args.contest;
        if (args.files) data.files = args.files;
        if (args.type === 'rejudge') {
            args.type = 'judge';
            data.rejudged = true;
        } else if (args.type === 'pretest') {
            data.input = args.input || '';
            data.contest = new ObjectId('000000000000000000000000');
        }
        const res = await RecordModel.coll.insertOne(data);
        if (addTask) {
            const priority = await RecordModel.submissionPriority(uid, args.type === 'pretest' ? -20 : (args.type === 'contest' ? 50 : 0));
            await RecordModel.judge(domainId, res.insertedId, priority, args.type === 'contest' ? { detail: false } : {}, { rejudge: data.rejudged });
        }
        return res.insertedId;
    }

    static getMulti(domainId: string, query: any) {
        if (domainId) query = { domainId, ...query };
        return RecordModel.coll.find(query);
    }

    static async update(
        domainId: string, _id: MaybeArray<ObjectId>,
        $set?: MatchKeysAndValues<RecordDoc>,
        $push?: PushOperator<RecordDoc>,
        $unset?: OnlyFieldsOfType<RecordDoc, any, true | '' | 1>,
        $inc?: Partial<Record<NumberKeys<RecordDoc>, number>>,
    ): Promise<RecordDoc | null> {
        const $update: UpdateFilter<RecordDoc> = {};
        if ($set && Object.keys($set).length) $update.$set = $set;
        if ($push && Object.keys($push).length) $update.$push = $push;
        if ($unset && Object.keys($unset).length) $update.$unset = $unset;
        if ($inc && Object.keys($inc).length) $update.$inc = $inc;
        if (_id instanceof Array) {
            await RecordModel.coll.updateMany({ _id: { $in: _id }, domainId }, $update);
            return null;
        }
        if (Object.keys($update).length) {
            const res = await RecordModel.coll.findOneAndUpdate(
                { _id, domainId },
                $update,
                { returnDocument: 'after' },
            );
            return res.value || null;
        }
        return await RecordModel.get(domainId, _id);
    }

    static async updateMulti(
        domainId: string, $match: Filter<RecordDoc>,
        $set?: MatchKeysAndValues<RecordDoc>,
        $push?: PushOperator<RecordDoc>,
        $unset?: OnlyFieldsOfType<RecordDoc, any, true | '' | 1>,
    ) {
        const $update: UpdateFilter<RecordDoc> = {};
        if ($set && Object.keys($set).length) $update.$set = $set;
        if ($push && Object.keys($push).length) $update.$push = $push;
        if ($unset && Object.keys($unset).length) $update.$unset = $unset;
        const res = await RecordModel.coll.updateMany({ domainId, ...$match }, $update);
        return res.modifiedCount;
    }

    static async reset(domainId: string, rid: MaybeArray<ObjectId>, isRejudge: boolean) {
        const upd: any = {
            score: 0,
            status: STATUS.STATUS_WAITING,
            time: 0,
            memory: 0,
            testCases: [],
            judgeTexts: [],
            compilerTexts: [],
            judgeAt: null,
            judger: null,
        };
        if (isRejudge) upd.rejudged = true;
        await task.deleteMany(rid instanceof Array ? { rid: { $in: rid } } : { rid });
        return RecordModel.update(domainId, rid, upd);
    }

    static count(domainId: string, query: any) {
        return RecordModel.coll.countDocuments({ domainId, ...query });
    }

    static async getList(
        domainId: string, rids: ObjectId[], fields?: (keyof RecordDoc)[],
    ): Promise<Record<string, Partial<RecordDoc>>> {
        const r: Record<string, RecordDoc> = {};
        rids = Array.from(new Set(rids));
        let cursor = RecordModel.coll.find({ domainId, _id: { $in: rids } });
        if (fields) cursor = cursor.project(buildProjection(fields));
        const rdocs = await cursor.toArray();
        for (const rdoc of rdocs) r[rdoc._id.toHexString()] = rdoc;
        return r;
    }
}

export function apply(ctx: Context) {
    // Mark problem as deleted
    ctx.on('problem/delete', (domainId, docId) => RecordModel.coll.deleteMany({ domainId, pid: docId }));
    ctx.on('domain/delete', (domainId) => RecordModel.coll.deleteMany({ domainId }));
    ctx.on('ready', () => db.ensureIndexes(
        RecordModel.coll,
        { key: { domainId: 1, contest: 1, _id: -1 }, name: 'basic' },
        { key: { domainId: 1, contest: 1, uid: 1, _id: -1 }, name: 'withUser' },
        { key: { domainId: 1, contest: 1, pid: 1, _id: -1 }, name: 'withProblem' },
        { key: { domainId: 1, contest: 1, pid: 1, uid: 1, _id: -1 }, name: 'withUserAndProblem' },
        { key: { domainId: 1, contest: 1, status: 1, _id: -1 }, name: 'withStatus' },
    ));
}

global.Hydro.model.record = RecordModel;
