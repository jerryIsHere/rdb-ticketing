
import { ObjectId, WithId, Document } from "mongodb";
import { Database, RequestError } from "./database";
import { BaseDAO } from "./dao";
import { EventDAO } from './event';
import { PriceTierDAO } from "./priceTier";
import { SeatDAO } from "./seat";
import { UserDAO } from "./user";
import { NotificationDAO } from "./notification";
import { Response } from "express";

type TicketInfo = {
    seat: WithId<Document> | null
    user: WithId<Document> | null
    event: EventDAO | null
}

export class TicketDAO extends BaseDAO {
    public static readonly collection_name = "tickets"
    private _eventId: ObjectId | undefined
    public get eventId() { return this._eventId }
    public set eventId(value: ObjectId | string | undefined) {
        this._eventId = new ObjectId(value);
    }

    private _seatId: ObjectId | undefined
    public get seatId() { return this._seatId }
    public set seatId(value: ObjectId | string | undefined) {
        this._seatId = new ObjectId(value);
    }

    private _priceTierId: ObjectId | undefined
    public get priceTierId() { return this._priceTierId }
    public set priceTierId(value: ObjectId | string | undefined) {
        this._priceTierId = new ObjectId(value);
    }
    private _securedBy: string | null | undefined = null
    public get securedBy() { return this._securedBy }
    public set securedBy(value: string | null | undefined) {
        if (value && value != this._securedBy) {
            this.confirmationDate = "$$NOW"
        }
        this._securedBy = value;
    }

    private _remark: String | null | undefined = null
    public get remark() { return this._remark }
    public set remark(value: String | null | undefined) {
        this._remark = value;
    }

    private _purchaseDate: Date | string | undefined | null = null
    public get purchaseDate() { return this._purchaseDate }
    public set purchaseDate(value: Date | string | undefined | null) {
        if (typeof value == "string") {
            if (value = "$$NOW") {
                this._purchaseDate = value
            }
            else {
                try {
                    this._purchaseDate = new Date(value);
                }
                catch (err) {
                    this.res.locals.RequestErrorList.push(new RequestError("Cannot parse lastLoginDate parameter of event request"))
                }
            }
        }
        else if (value instanceof Date) {
            this._purchaseDate = value;
        }
    }

    private _confirmationDate: Date | string | undefined | null = null
    public get confirmationDate() { return this._confirmationDate }
    public set confirmationDate(value: Date | string | undefined | null) {
        if (typeof value == "string") {
            if (value = "$$NOW") {
                this._confirmationDate = value
            }
            else {
                try {
                    this._confirmationDate = new Date(value);
                }
                catch (err) {
                    this.res.locals.RequestErrorList.push(new RequestError("Cannot parse lastLoginDate parameter of event request"))
                }
            }
        }
        else if (value instanceof Date) {
            this._confirmationDate = value;
        }
    }

    private _occupantId?: ObjectId | undefined | null = null
    public get occupantId(): ObjectId | undefined | null { return this._occupantId }
    public void(username?: string) {
        return new Promise<TicketDAO>(async (resolve, reject) => {
            if (this.occupantId) {
                this.res.locals.session.startTransaction()
                let originalOccupant = await UserDAO.getById(this.res, this.occupantId.toString()).catch(err => reject(err))
                if (originalOccupant && originalOccupant.email) {
                    this._occupantId = null
                    try {
                        await this.checkReference()
                    }
                    catch (err) {
                        reject(err)
                        return
                    }
                    if (this.res.locals.RequestErrorList.length > 0)
                        reject(null)
                    if (this.id) {
                        Database.mongodb.collection(TicketDAO.collection_name)
                            .updateOne(
                                { _id: this.id },
                                { $set: { "occupantId": null, securedBy: null, remark: null, confirmationDate: null, purchaseDate: null } }, { session: this.res.locals.session }
                            ).then(async (value) => {
                                if (value.modifiedCount > 0) {
                                    if (this.seatId && this.eventId && originalOccupant && originalOccupant.email) {
                                        let seatDao = await SeatDAO.getById(this.res, this.seatId.toString()).catch(err => console.log(err));
                                        let eventDao = await EventDAO.getById(this.res, this.eventId.toString()).catch(err => console.log(err));
                                        let customerSupportInfo = username ? ` by ${username}` : ''
                                        let purchaseDateInfo = this.purchaseDate ? ` (at ${this.purchaseDate.toLocaleString()})` : ''
                                        let salutation = originalOccupant.fullname ? `Dear ${originalOccupant.fullname}\n` : ""
                                        let notificationDao = new NotificationDAO(this.res, {
                                            email: originalOccupant.email,
                                            title: "Ticket Voided",
                                            message:
                                                salutation +
                                                `1 ticket that you had purchased${purchaseDateInfo} is voided${customerSupportInfo}.
Information of that ticket:
Event: ${eventDao ? eventDao.eventname : ''}
Seat: ${seatDao && seatDao.row && seatDao.no ? seatDao.row + seatDao.no : ''}`,
                                            recipientId: originalOccupant.id
                                        })
                                        await notificationDao.create().catch(err => reject(err))
                                        notificationDao.send().catch(err => console.log(err))
                                    }
                                    resolve(this)
                                }
                            })
                    }
                    else {
                        reject(new RequestError(`${this.constructor.name}'s id is not initialized.`))
                    }
                }
                else {
                    if (originalOccupant instanceof Object && originalOccupant.email == undefined) {
                        reject(new RequestError(`Ticket with id ${this.id} has an occupant without email information.`))
                    }
                    if (originalOccupant)
                        reject(new RequestError(`Ticket with id ${this.id} has an invalid occupant.`))
                    return
                }

            } else {
                reject(new RequestError(`Ticket with id ${this.id} is already avaliable.`))
                return
            }
        })
    }
    public claim(userId: string): Promise<TicketDAO> {
        return new Promise<TicketDAO>(async (resolve, reject) => {
            this.res.locals.session.startTransaction()
            let originalOccupant = await UserDAO.getById(this.res, userId).catch(err => reject(err))
            if (originalOccupant && originalOccupant.email) {
                if (this.id) {
                    Database.mongodb.collection(TicketDAO.collection_name)
                        .updateOne(
                            { _id: this.id, occupantId: null },
                            [{ $set: { "occupantId": userId, "purchaseDate": "$$NOW" } }], { session: this.res.locals.session }
                        ).then(async (value) => {
                            if (value.modifiedCount > 0) {
                                if (originalOccupant && originalOccupant.email) {
                                    let notificationDao = new NotificationDAO(this.res, {
                                        email: originalOccupant.email,
                                        title: "Ticket Purchased",
                                        message: `1 ticket purchased, for follow-up info, please visit: ${process.env.BASE_PRODUCTION_URI}/payment-info?ids=${this.id}`,
                                        recipientId: userId
                                    })
                                    await notificationDao.create().catch(err => reject(err))
                                    notificationDao.send().catch(err => console.log(err))
                                }
                                resolve(this)
                            }
                            else {
                                reject(new RequestError(`Ticket with id ${this.id} is not avaliable.`))
                                return
                            }
                        })
                }
                else {
                    reject(new RequestError(`${this.constructor.name}'s id is not initialized.`))
                    return
                }
            }

            this._occupantId = new ObjectId(userId)
            try {
                await this.checkReference(true, new ObjectId(userId))
            }
            catch (err) {
                reject(err)
                return
            }
        })
    }
    constructor(
        res: Response,
        params: { securedBy?: string, remark?: string } & { doc?: WithId<Document> }
    ) {
        super(res, params.doc && params.doc._id ? params.doc._id : undefined);
        if (params.doc && params.doc._id) {
            this._eventId = params.doc.eventId
            this._seatId = params.doc.seatId
            this._occupantId = params.doc.occupantId
            this._priceTierId = params.doc.priceTierId
            this._securedBy = params.doc.securedBy
            this._remark = params.doc.remark
            this._confirmationDate = params.doc.confirmDateparams ? params.doc.confirmDateparams : null
            this._purchaseDate = params.doc.purchaseDate ? params.doc.purchaseDate : null
        }
        if (params.securedBy)
            this.securedBy = params.securedBy
        if (params.remark)
            this.remark = params.remark
    }

    static lookupQuery = (condition: Document, param: { showOccupant: boolean, checkIfBelongsToUser?: string }) => {
        return [
            ...[
                condition,
                {
                    $lookup:
                    {
                        from: EventDAO.collection_name,
                        localField: "eventId",
                        foreignField: "_id",
                        as: "event",
                    }
                },
                {
                    $lookup:
                    {
                        from: SeatDAO.collection_name,
                        localField: "seatId",
                        foreignField: "_id",
                        as: "seat",
                    }
                },
                {
                    $lookup:
                    {
                        from: PriceTierDAO.collection_name,
                        localField: "priceTierId",
                        foreignField: "_id",
                        as: "priceTier",
                    }
                },
            ],
            ...param.checkIfBelongsToUser ? [
                { $set: { 'belongsToUser': { $cond: { if: { $eq: ["$occupantId", new ObjectId(param.checkIfBelongsToUser)] }, then: true, else: false } } } },
            ] : [],
            ...param.showOccupant ? [
                {
                    $lookup:
                    {
                        from: UserDAO.collection_name,
                        localField: "occupantId",
                        foreignField: "_id",
                        as: "occupant",
                    }
                },
                { $set: { 'occupant': { $first: '$occupant' } } }
            ] :
                [
                    { $set: { 'occupied': { $cond: { if: { $ne: ["$occupantId", null] }, then: true, else: false } } } },
                    { $project: { occupantId: 0 } },
                ],
            ...[
                { $set: { 'event': { $first: '$event' } } },
                { $set: { 'seat': { $first: '$seat' } } },
                { $set: { 'priceTier': { $first: '$priceTier' } } },

            ]
        ]

    }
    static async listByEventId(evnetId: string, param: { showOccupant: boolean }) {
        return new Promise<Document[]>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(TicketDAO.collection_name).
                aggregate(this.lookupQuery({ $match: { eventId: new ObjectId(evnetId) } }, param))
            resolve((await cursor.toArray()));
        })
    }
    static async listSold(param: { showOccupant: boolean }) {
        return new Promise<Document[]>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(TicketDAO.collection_name).
                aggregate(this.lookupQuery({ $match: { occupantId: { $ne: null } } }, param))
            resolve((await cursor.toArray()));
        })
    }
    static async listByIds(ids: string[], param: { showOccupant: boolean, checkIfBelongsToUser?: string }) {
        return new Promise<Document[]>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(TicketDAO.collection_name).
                aggregate(this.lookupQuery({ $match: { _id: { $in: ids.map(id => new ObjectId(id)) } } }, param))
            resolve((await cursor.toArray()));
        })
    }
    static async ofUser(userId: string, param: { showOccupant: boolean }) {
        return new Promise<Document[]>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(TicketDAO.collection_name).
                aggregate(this.lookupQuery({ $match: { occupantId: new ObjectId(userId) } }, param))
            resolve((await cursor.toArray()));
        })
    }
    static async getWithDetailsById(id: string, param: { showOccupant: boolean }) {
        return new Promise<Document>(async (resolve, reject) => {
            var cursor = Database.mongodb.collection(TicketDAO.collection_name).
                aggregate(this.lookupQuery({ $match: { occupantId: new ObjectId(id) } }, param))
            var docs = await cursor.toArray()
            if (docs.length > 0) {
                resolve(docs[0])
            } else {
                reject(new RequestError(`${this.name} has no instance with id ${id}.`))
            }
        })
    }
    static async getById(
        res: Response, id: string) {
        return new Promise<TicketDAO>(async (resolve, reject) => {
            var doc = await Database.mongodb.collection(TicketDAO.collection_name).findOne({ _id: new ObjectId(id) })
            if (doc) {
                resolve(new TicketDAO(res, { doc: doc }))
            }
            reject(new RequestError(`${this.name} has no instance with id ${id}.`))
        })
    }
    static async getByIds(
        res: Response, ids: string[]): Promise<TicketDAO[]> {
        return new Promise<TicketDAO[]>(async (resolve, reject) => {
            Promise.all(
                ids.map(async id =>
                    new Promise<TicketDAO>(async (daoresolve, daoreject) => {
                        var doc = await Database.mongodb.collection(TicketDAO.collection_name).findOne({ _id: new ObjectId(id) })
                        if (doc) {
                            daoresolve(new TicketDAO(res, { doc: doc }))
                        }
                        daoreject(new RequestError(`${this.name} has no instance with id ${id}.`))
                    }))
            ).then(daos => {
                resolve(daos)
            })
        })
    }
    async checkReference(checkIsSelling: boolean = false, checkQuotaForUserId?: ObjectId, purchaseQuantity = 1): Promise<TicketInfo | null> {
        if (this._eventId == undefined) {
            this.res.locals.RequestErrorList.push(new RequestError(`Ticket with id ${this._id} has no associate event.`))
            return null
        }
        var event = await EventDAO.getById(this.res, this._eventId.toString())
        if (event && event.startFirstRoundSellDate &&
            event.endFirstRoundSellDate &&
            event.startSecondRoundSellDate &&
            event.endSecondRoundSellDate &&
            event.shoppingCartSize != undefined && Number.isFinite(Number(event.shoppingCartSize)) &&
            event.firstRoundTicketQuota != undefined && Number.isFinite(Number(event.firstRoundTicketQuota)) &&
            event.secondRoundTicketQuota != undefined && Number.isFinite(Number(event.secondRoundTicketQuota))) {
            if (checkIsSelling) {
                var isSelling = (event.startFirstRoundSellDate <= new Date() && event.endFirstRoundSellDate >= new Date()) ||
                    (event.startSecondRoundSellDate <= new Date() && event.endSecondRoundSellDate >= new Date())
                if (!isSelling) {
                    this.res.locals.RequestErrorList.push(new RequestError(`Ticket of event with id ${this._eventId} doesn't exists is not selling.`))
                    return null
                }
            }
            let venueId = event.venueId
            await Database.mongodb.collection(PriceTierDAO.collection_name).findOne({ _id: this._priceTierId }).then(instance => {
                if (instance == null) {
                    this.res.locals.RequestErrorList.push(new RequestError(`Price Tier with id ${this._priceTierId} doesn't exists.`))
                }
            })
            let seatDoc = await Database.mongodb.collection(SeatDAO.collection_name).findOne({ _id: this._seatId, venueId: venueId }).then(instance => {
                if (instance == null) {
                    this.res.locals.RequestErrorList.push(new RequestError(`Seat with id ${this._seatId} in the same event venue with id ${venueId} doesn't exists.`))
                }
                return instance
            })
            if (checkQuotaForUserId != undefined) {
                var count = await Database.mongodb.collection(TicketDAO.collection_name).aggregate([
                    { $match: { occupantId: checkQuotaForUserId, eventId: this.eventId } }, { $count: "bought" }]).tryNext()
                if (count != null && Number.isInteger(count.bought)) {
                    let quota =
                        (event.startFirstRoundSellDate <= new Date() && event.endFirstRoundSellDate >= new Date()) ?
                            event.firstRoundTicketQuota : (event.startSecondRoundSellDate <= new Date() && event.endSecondRoundSellDate >= new Date()) ?
                                event.secondRoundTicketQuota :
                                0
                    if (quota > -1 && count.bought + purchaseQuantity > quota) {
                        this.res.locals.RequestErrorList.push(new RequestError(`You have no more ticket quota for this show.`))
                    }
                }
            }
            let userDoc = null
            if (this._occupantId) {
                userDoc = await Database.mongodb.collection(UserDAO.collection_name).findOne({ _id: this._occupantId }).then(instance => {
                    if (instance == null) {
                        this.res.locals.RequestErrorList.push(new RequestError(`User with id ${this._seatId} doesn't exists.`))

                    }
                    return instance
                })
            }
            return { seat: seatDoc, user: userDoc, event: event }
        }
        else {
            if (event == null)
                this.res.locals.RequestErrorList.push(new RequestError(`Event with id ${this._eventId} doesn't exists.`))
            if (!checkIsSelling) return null
            if (event.startFirstRoundSellDate == undefined || event.startFirstRoundSellDate > new Date())
                this.res.locals.RequestErrorList.push(new RequestError(`The first round of ticket selling of event with id ${this._eventId} is not started yet.`))
            if (event.endFirstRoundSellDate == undefined || event.endFirstRoundSellDate < new Date())
                this.res.locals.RequestErrorList.push(new RequestError(`The first round of selling of event with id ${this._eventId} was ended.`))
            if (event.startSecondRoundSellDate == undefined || event.startSecondRoundSellDate > new Date())
                this.res.locals.RequestErrorList.push(new RequestError(`The second round of ticket selling of event with id ${this._eventId} is not started yet.`))
            if (event.endSecondRoundSellDate == undefined || event.endSecondRoundSellDate < new Date())
                this.res.locals.RequestErrorList.push(new RequestError(`The second round of selling of event with id ${this._eventId} was ended.`))
            return null
        }
    }
    async duplicationChecking() {
        await Database.mongodb.collection(TicketDAO.collection_name).findOne({ eventId: this.eventId, seatId: this.seatId }).then(instance => {
            if (instance) {
                this.res.locals.RequestErrorList.push(new RequestError(`Ticket with same event with id ${this.eventId} and seat with id ${this.seatId} already exists.`))
            }
        })
    }
    async create(): Promise<TicketDAO> {
        return new Promise<TicketDAO>(async (resolve, reject) => {
            this.res.locals.session.startTransaction()
            try {
                await this.checkReference()
                await this.duplicationChecking()
            }
            catch (err) {
                reject(err)
                return
            }
            var result = await Database.mongodb.collection(TicketDAO.collection_name).insertOne(this.Serialize(true), { session: this.res.locals.session })
            if (result.insertedId) {
                resolve(this)
            }
            else {
                reject(new RequestError(`Creation of ${this.constructor.name} failed with unknown reason.`))
            }
        })
    }
    static async batchCreate(res: Response, daos: TicketDAO[]): Promise<TicketDAO[]> {
        return new Promise<TicketDAO[]>((resolve, reject) => {
            res.locals.session.startTransaction()
            Promise.all(daos.map(dao =>
                new Promise<TicketDAO>(async (daoresolve, daoreject) => {
                    try {
                        await dao.checkReference()
                        await dao.duplicationChecking()
                    }
                    catch (err) {
                        daoreject(err)
                        return
                    }
                    try {
                        var result = await Database.mongodb.collection(TicketDAO.collection_name).insertOne(dao.Serialize(true), { session: res.locals.session })
                        if (result && result.insertedId) {
                            daoresolve(dao)
                        }
                        else {
                            daoreject(new RequestError(`Creation of ${dao.constructor.name} failed with unknown reason.`))
                        }
                    } catch (err) { console.log(err); reject(new RequestError(`Server is busy. Please retry later and perhaps reduce the size of your request..`)) }
                })
            )).then(daos => {
                resolve(daos)
            })
        })
    }
    static async batchUdatePriceTier(res: Response, daos: TicketDAO[], priceTierId: string): Promise<TicketDAO[]> {
        return new Promise<TicketDAO[]>((resolve, reject) => {
            res.locals.session.startTransaction()
            Promise.all(daos.map(dao =>
                new Promise<TicketDAO>(async (daoresolve, daoreject) => {
                    try {
                        dao.priceTierId = new ObjectId(priceTierId)
                        await dao.checkReference()
                    }
                    catch (err) {
                        daoreject(err)
                        return
                    }
                    if (dao._id) {
                        try {
                            var result = await Database.mongodb.collection(TicketDAO.collection_name)
                                .updateOne({ _id: dao._id }, { $set: dao.Serialize(true) }, { session: res.locals.session })
                            if (result) {
                                daoresolve(dao)
                            }
                            else {
                                daoreject(new RequestError(`Update of ${dao.constructor.name} failed with unknown reason.`))
                            }
                        } catch (err) { console.log(err); reject(new RequestError(`Server is busy. Please retry later and perhaps reduce the size of your request..`)) }
                    }
                    else {
                        reject(new RequestError(`One of the ticket's id is not initialized.`))
                    }
                })
            )).then(daos => {
                resolve(daos)
            })
        })
    }
    async update(): Promise<TicketDAO> {
        return new Promise<TicketDAO>(async (resolve, reject) => {
            if (this._id == undefined) { reject(new RequestError(`${this.constructor.name}'s id is not initialized.`)); return }
            try {
                await this.checkReference()
            }
            catch (err) {
                reject(err)
                return
            }
            var result = await Database.mongodb.collection(TicketDAO.collection_name).updateOne({ _id: new ObjectId(this._id) }, [{ $set: this.Serialize(true) }], { session: this.res.locals.session })
            if (result.modifiedCount > 0) {
                resolve(this)
            }
            else {
                reject(new RequestError(`Update of ${this.constructor.name} with id ${this._id} failed with unknown reason.`))
            }

        })
    }
    static async batchClaim(res: Response, daos: TicketDAO[], userId: string): Promise<TicketDAO[]> {
        return new Promise<TicketDAO[]>(async (resolve, reject) => {
            res.locals.session.startTransaction()
            let originalOccupant = await UserDAO.getById(res, userId).catch(err => reject(err))
            if (originalOccupant && originalOccupant.email) {
                Promise.all(daos.map(dao =>
                    new Promise<{ dao: TicketDAO, info?: TicketInfo }>(async (daoresolve, daoreject) => {
                        dao._occupantId = new ObjectId(userId)
                        let info
                        try {
                            info = await dao.checkReference(true, new ObjectId(userId), daos.length)
                        }
                        catch (err) {
                            daoreject(err)
                            return
                        }
                        if (dao.id) {
                            try {
                                var result = await Database.mongodb.collection(TicketDAO.collection_name).updateOne(
                                    { _id: dao.id, occupantId: null },
                                    [{ $set: { "occupantId": userId, "purchaseDate": "$$NOW" } }], { session: res.locals.session })
                                if (result && result.modifiedCount > 0) {
                                    daoresolve({ dao: dao, info: info ? info : undefined })
                                }
                                else {
                                    daoreject(new RequestError(`Ticket with id ${dao.id} is not avaliable.`))
                                }
                            } catch (err) { console.log(err); reject(new RequestError(`Server is busy. Please retry later and perhaps reduce the size of your request..`)) }
                        }
                    })
                )).then(async (ticketDaoWithInfo: { dao: TicketDAO, info?: TicketInfo }[]) => {
                    if (originalOccupant && originalOccupant.email && res.locals.RequestErrorList.length == 0) {
                        let eventInfoString = ticketDaoWithInfo[0].info?.event?.eventname ? ` for event ${ticketDaoWithInfo[0].info?.event?.eventname} ` : ''
                        let notificationDao = new NotificationDAO(res, {
                            title: "Ticket Purchased",
                            email: originalOccupant.email,
                            message:
                                `Dear ${ticketDaoWithInfo[0].info?.user?.fullname}\n` +
                                `${ticketDaoWithInfo.length} ticket${ticketDaoWithInfo.length > 1 ? 's' : ''}${eventInfoString} is  purchased:\n` +
                                ticketDaoWithInfo.map(withInfo => withInfo.info?.seat?.row + withInfo.info?.seat?.no).join(", ") +
                                `\nFor follow-up info, please visit: ${process.env.BASE_PRODUCTION_URI}/payment-info?`
                                + ticketDaoWithInfo.map(withInfo => 'ids=' + withInfo.dao._id?.toString()).join('&') + `&userId=${userId}`,
                            recipientId: userId
                        })
                        await notificationDao.create().catch(err => reject(err))
                        notificationDao.send().catch(err => console.log(err))
                    }
                    resolve(ticketDaoWithInfo.map(withInfo => withInfo.dao))
                }).catch(reason => reject(reason))
            }
            else {
                if (originalOccupant instanceof Object && originalOccupant.email == undefined) {
                    reject(new RequestError(`User with id ${userId} has an occupant without email information.`))
                }
                if (originalOccupant)
                    reject(new RequestError(`User id ${userId} not found.`))
                return
            }
        })
    }
    async delete(): Promise<TicketDAO> {
        return new Promise<TicketDAO>(async (resolve, reject) => {
            if (this._id == undefined) { reject(new RequestError(`${this.constructor.name}'s id is not initialized.`)); return }
            var result = await Database.mongodb.collection(TicketDAO.collection_name).deleteOne({ _id: new ObjectId(this._id) }, { session: this.res.locals.session })
            if (result.deletedCount > 0) {
                resolve(this)
            }
            else {
                reject(new RequestError(`Deletation of ${this.constructor.name} with id ${this._id} failed with unknown reason.`))
            }

        })
    }
    static async batchDelete(res: Response, daos: TicketDAO[]): Promise<TicketDAO[]> {
        return new Promise<TicketDAO[]>((resolve, reject) => {
            res.locals.session.startTransaction()
            Promise.all(daos.filter(dao => dao.id != undefined).map(dao =>
                new Promise<TicketDAO>(async (daoresolve, daoreject) => {
                    if (dao.occupantId != null) {
                        daoreject(new RequestError(`Deletation of ${dao.constructor.name} with id ${dao.id} failed as it has occupant.`))
                    }
                    try {
                        var result = await Database.mongodb.collection(TicketDAO.collection_name).deleteOne(dao.Serialize(true), { session: res.locals.session })
                        if (result && result.deletedCount > 0) {
                            daoresolve(dao)
                        }
                        else {
                            daoreject(new RequestError(`Deletation of ${dao.constructor.name} with id ${dao.id} failed with unknown reason.`))
                        }
                    } catch (err) { console.log(err); reject(new RequestError(`Server is busy. Please retry later and perhaps reduce the size of your request..`)) }
                })
            )).then(daos => {
                resolve(daos)
            })
        })
    }
}
