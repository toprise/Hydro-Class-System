import { Filter, ObjectId } from 'mongodb';
import { MessageDoc } from '../interface';
import * as bus from '../service/bus';
import db from '../service/db';
import { ArgMethod } from '../utils';
import { PRIV } from './builtin';
import * as system from './system';
import user from './user';

class MessageModel {
    static FLAG_UNREAD = 1;
    static FLAG_ALERT = 2;
    static FLAG_RICHTEXT = 4;
    static FLAG_INFO = 8;

    static coll = db.collection('message');

    @ArgMethod
    static async send(
        from: number, to: number,
        content: string, flag: number = MessageModel.FLAG_UNREAD,
    ) {
        const _id = new ObjectId();
        const mdoc: MessageDoc = {
            _id, from, to, content, flag,
        };
        await MessageModel.coll.insertOne(mdoc);
        if (from !== to) bus.broadcast('user/message', to, mdoc);
        if (flag & MessageModel.FLAG_UNREAD) await user.inc(to, 'unreadMsg', 1);
        return mdoc;
    }

    static async sendInfo(to: number, content: string) {
        const _id = new ObjectId();
        const mdoc: MessageDoc = {
            _id, from: 1, to, content, flag: MessageModel.FLAG_INFO,
        };
        bus.broadcast('user/message', to, mdoc);
    }

    static async get(_id: ObjectId) {
        return await MessageModel.coll.findOne({ _id });
    }

    @ArgMethod
    static async getByUser(uid: number) {
        return await MessageModel.coll.find({ $or: [{ from: uid }, { to: uid }] }).sort('_id', -1).limit(1000).toArray();
    }

    static async getMany(query: Filter<MessageDoc>, sort: any, page: number, limit: number) {
        return await MessageModel.coll.find(query).sort(sort)
            .skip((page - 1) * limit).limit(limit)
            .toArray();
    }

    static async setFlag(messageId: ObjectId, flag: number) {
        const result = await MessageModel.coll.findOneAndUpdate(
            { _id: messageId },
            { $bit: { flag: { xor: flag } } },
            { returnDocument: 'after' },
        );
        return result.value || null;
    }

    static async del(_id: ObjectId) {
        return await MessageModel.coll.deleteOne({ _id });
    }

    @ArgMethod
    static count(query: Filter<MessageDoc> = {}) {
        return MessageModel.coll.countDocuments(query);
    }

    static getMulti(uid: number) {
        return MessageModel.coll.find({ $or: [{ from: uid }, { to: uid }] });
    }

    static async sendNotification(message: string, ...args: any[]) {
        const targets = await user.getMulti({ priv: { $bitsAllSet: PRIV.PRIV_VIEW_SYSTEM_NOTIFICATION } })
            .project({ _id: 1, viewLang: 1 }).toArray();
        return Promise.all(targets.map(({ _id, viewLang }) => {
            const msg = message.translate(viewLang || system.get('server.language')).format(...args);
            return MessageModel.send(1, _id, msg, MessageModel.FLAG_RICHTEXT);
        }));
    }
}

export async function apply() {
    return db.ensureIndexes(
        MessageModel.coll,
        { key: { to: 1, _id: -1 }, name: 'to' },
        { key: { from: 1, _id: -1 }, name: 'from' },
    );
}
export default MessageModel;
global.Hydro.model.message = MessageModel;
