import { ObjectId, WithId, Document, } from "mongodb";
import { Database, RequestError } from "./database";
import { BaseDAO } from "./dao";
import { VenueDAO } from "./venue";
import { TicketDAO } from "./ticket";
import { SeatDAO } from "./seat";
import { Response } from "express";



export class EventDAO extends BaseDAO {
    public static readonly collection_name = "events"
    private _eventname: string | undefined
    public get eventname() { return this._eventname }
    public set eventname(value: string | undefined) { this._eventname = value; }

    private _datetime: Date | undefined
    public get datetime() { return this._datetime }
    public set datetime(value: Date | string | undefined) {
        if (typeof value == "string") {
            try {
                this._datetime = new Date(value);
            }
            catch (err) {
                this.res.locals.RequestErrorList.push(new RequestError("Cannot parse datetime parameter of event request"))
            }
        }
        else if (value instanceof Date) {
            this._datetime = value;
        }
    }

    private _startSellDate: Date | undefined
    public get startSellDate() { return this._startSellDate }
    public set startSellDate(value: Date | string | undefined) {
        if (typeof value == "string") {
            try {
                this._startSellDate = new Date(value);
            }
            catch (err) {
                this.res.locals.RequestErrorList.push(new RequestError("Cannot parse startSellDate parameter of event request"))
            }
        }
        else if (value instanceof Date) {
            this._startSellDate = value;
        }
    }
    private _endSellDate: Date | undefined
    public get endSellDate() { return this._endSellDate }
    public set endSellDate(value: Date | string | undefined) {
        if (typeof value == "string") {
            try {
                this._endSellDate = new Date(value);
            }
            catch (err) {
                this.res.locals.RequestErrorList.push(new RequestError("Cannot parse endSellDate parameter of event request"))
            }
        }
        else if (value instanceof Date) {
            this._endSellDate = value;
        }
    }
    private _duration: number | undefined
    public get duration() { return this._duration }
    public set duration(value: number | undefined) {
        if (value && value < 0) {
            this.res.locals.RequestErrorList.push(new RequestError('Duration must be greater then 0.'))
        }
        else {
            this._duration = value;
        }
    }

    private _venueId: ObjectId | undefined
    public get venueId() { return this._venueId }
    public set venueId(value: ObjectId | string | undefined) {
        this._venueId = new ObjectId(value);
    }

    constructor(
        res: Response, params: {
            eventname?: string,
            datetime?: Date,
            startSellDate?: Date,
            endSellDate?: Date,
            duration?: number,
        } & { doc?: WithId<Document> }
    ) {
        super(res, params.doc && params.doc._id ? params.doc._id : undefined);
        if (params.doc && params.doc._id) {


            this._eventname = params.doc.eventname
            this._datetime = params.doc.datetime
            this._startSellDate = params.doc.startSellDate
            this._endSellDate = params.doc.endSellDate
            this._duration = params.doc.duration
            this._venueId = params.doc.venueId
        }
        if (params.eventname)
            this.eventname = params.eventname

        if (params.datetime)
            this.datetime = params.datetime

        if (params.startSellDate)
            this.startSellDate = params.startSellDate

        if (params.endSellDate)
            this.endSellDate = params.endSellDate

        if (params.duration)
            this.duration = params.duration
    }
    static async listAll() {
        return new Promise<Document[]>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(EventDAO.collection_name).aggregate([
                {
                    $lookup:
                    {
                        from: VenueDAO.collection_name,
                        localField: "venueId",
                        foreignField: "_id",
                        as: "venue",
                    }
                },
                { $set: { 'venue': { $first: '$venue' } } }
            ])
            resolve((await cursor.toArray()));
        })
    }
    static async listSelling() {
        return new Promise<Document[]>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(EventDAO.collection_name).aggregate([
                {
                    $match: {
                        $and: [
                            { startSellDate: { $lte: new Date() } },
                            { endSellDate: { $gte: new Date() } },
                        ]
                    }
                },
                {
                    $lookup:
                    {
                        from: VenueDAO.collection_name,
                        localField: "venueId",
                        foreignField: "_id",
                        as: "venue",
                    }
                },
                { $set: { 'venue': { $first: '$venue' } } }
            ])
            resolve((await cursor.toArray()));
        })
    }
    static async getById(
        res: Response, id: string) {
        return new Promise<EventDAO>(async (resolve, reject) => {
            var doc = await Database.mongodb.collection(EventDAO.collection_name).findOne({ _id: new ObjectId(id) }, { session: res.locals.session })
            if (doc) {
                resolve(new EventDAO(res, { doc: doc }))
            }
            reject(new RequestError(`${this.name} has no instance with id ${id}.`))
        })
    }
    async checkReference(): Promise<null | RequestError> {
        return Database.mongodb.collection(VenueDAO.collection_name).findOne({ _id: this._venueId }, { session: this.res.locals.session }).then(instance => {
            if (instance == null) {
                return new RequestError(`Venue with id ${this._venueId} doesn't exists.`)
            }
            else {
                return null
            }
        })
    }
    async create(): Promise<EventDAO> {
        return new Promise<EventDAO>(async (resolve, reject) => {
            this.res.locals.session.startTransaction()
            var referror = await this.checkReference()
            if (referror) {
                reject(referror)
                return
            }
            var result = await Database.mongodb.collection(EventDAO.collection_name).insertOne(this.Serialize(true), { session: this.res.locals.session })
            if (result.insertedId) {
                resolve(this)
            }
            else {
                reject(new RequestError(`Creation of ${this.constructor.name} failed with unknown reason.`))
            }
        })
    }
    async checkTicketVenueDependency() {
        if (this._id) {
            return (await Database.mongodb.collection(TicketDAO.collection_name).aggregate([
                { $match: { eventId: new ObjectId(this._id) } },
                {
                    $lookup:
                    {
                        from: SeatDAO.collection_name,
                        localField: "seatId",
                        foreignField: "_id",
                        as: "seat",
                    }
                },
                { $set: { 'seat': { $first: '$seat' } } },
                { $match: { 'seat.venueId': { $ne: new ObjectId(this.venueId) } } },
            ], { session: this.res.locals.session })).next()
        }
        return
    }
    async update(): Promise<EventDAO> {
        return new Promise<EventDAO>(async (resolve, reject) => {
            var dependency = await this.checkTicketVenueDependency()
            if (dependency != null) {
                reject(new RequestError(`Update of ${this.constructor.name} with id ${this._id} failed ` +
                    `as ticket with id ${dependency._id} depends on another venue ${dependency.seat.venueId}.`)); return
            }
            if (this._id) {
                var result = await Database.mongodb.collection(EventDAO.collection_name).updateOne({ _id: new ObjectId(this._id) }, { $set: this.Serialize(true) }, { session: this.res.locals.session })
                if (result.modifiedCount > 0) {
                    resolve(this)
                }
                else {
                    reject(new RequestError(`Update of ${this.constructor.name} with id ${this._id} failed with unknown reason.`))
                }
            } else {
                reject(new RequestError(`${this.constructor.name}'s id is not initialized.`))
            }
        })
    }
    async checkTicketDependency() {
        if (this._id) {
            return await Database.mongodb.collection(TicketDAO.collection_name).findOne({ eventId: new ObjectId(this._id) }, { session: this.res.locals.session })
        }
        return
    }
    async delete(): Promise<EventDAO> {
        return new Promise<EventDAO>(async (resolve, reject) => {
            this.res.locals.session.startTransaction()
            var dependency = await this.checkTicketDependency()
            if (dependency) {
                reject(new RequestError(`Deletation of ${this.constructor.name} with id ${this._id} failed ` +
                    `as ticket with id ${dependency._id} depends on it.`)); return
            }
            if (this._id) {
                var result = await Database.mongodb.collection(EventDAO.collection_name).deleteOne({ _id: new ObjectId(this._id) }, { session: this.res.locals.session })
                if (result.deletedCount > 0) {

                    resolve(this)
                }
            }
            else { reject(new RequestError(`${this.constructor.name}'s id is not initialized.`)); return }
        })
    }
}


