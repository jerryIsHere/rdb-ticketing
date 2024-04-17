"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketDAO = void 0;
const mongodb_1 = require("mongodb");
const database_1 = require("./database");
const dao_1 = require("./dao");
const event_1 = require("./event");
const priceTier_1 = require("./priceTier");
const seat_1 = require("./seat");
const user_1 = require("./user");
const notification_1 = require("./notification");
class TicketDAO extends dao_1.BaseDAO {
    get eventId() { return this._eventId; }
    set eventId(value) {
        this._eventId = new mongodb_1.ObjectId(value);
    }
    get seatId() { return this._seatId; }
    set seatId(value) {
        this._seatId = new mongodb_1.ObjectId(value);
    }
    get priceTierId() { return this._priceTierId; }
    set priceTierId(value) {
        this._priceTierId = new mongodb_1.ObjectId(value);
    }
    get securedBy() { return this._securedBy; }
    set securedBy(value) {
        this._securedBy = value;
    }
    get remark() { return this._remark; }
    set remark(value) {
        this._remark = value;
    }
    get occupantId() { return this._occupantId; }
    void() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (this.occupantId) {
                this.res.locals.session.startTransaction();
                let originalOccupant = yield user_1.UserDAO.getById(this.res, this.occupantId.toString()).catch(err => reject(err));
                if (originalOccupant && originalOccupant.email) {
                    this._occupantId = null;
                    try {
                        yield this.checkReference();
                    }
                    catch (err) {
                        reject(err);
                        return;
                    }
                    if (this.res.locals.RequestErrorList.length > 0)
                        reject(null);
                    if (this.id) {
                        database_1.Database.mongodb.collection(TicketDAO.collection_name)
                            .updateOne({ _id: this.id }, { $set: { "occupantId": null, securedBy: null, remark: null } }, { session: this.res.locals.session }).then((value) => __awaiter(this, void 0, void 0, function* () {
                            if (value.modifiedCount > 0) {
                                if (this.seatId && this.eventId && originalOccupant && originalOccupant.email) {
                                    let seatDao = yield seat_1.SeatDAO.getById(this.res, this.seatId.toString()).catch(err => console.log(err));
                                    let eventDao = yield event_1.EventDAO.getById(this.res, this.eventId.toString()).catch(err => console.log(err));
                                    let notificationDao = new notification_1.NotificationDAO(this.res, {
                                        email: originalOccupant.email,
                                        title: "Ticket Voided",
                                        message: `1 ticket that you had purchased is voided. Information of that ticket:
Event: ${eventDao ? eventDao.eventname : ''}
Seat: ${seatDao && seatDao.row && seatDao.no ? seatDao.row + seatDao.no : ''}`,
                                        recipientId: originalOccupant.id
                                    });
                                    yield notificationDao.create().catch(err => reject(err));
                                    notificationDao.send().catch(err => console.log(err));
                                }
                                resolve(this);
                            }
                        }));
                    }
                    else {
                        reject(new database_1.RequestError(`${this.constructor.name}'s id is not initialized.`));
                    }
                }
                else {
                    if (originalOccupant instanceof Object && originalOccupant.email == undefined) {
                        reject(new database_1.RequestError(`Ticket with id ${this.id} has an occupant without email information.`));
                    }
                    if (originalOccupant)
                        reject(new database_1.RequestError(`Ticket with id ${this.id} has an invalid occupant.`));
                    return;
                }
            }
            else {
                reject(new database_1.RequestError(`Ticket with id ${this.id} is already avaliable.`));
                return;
            }
        }));
    }
    claim(userId) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            this.res.locals.session.startTransaction();
            let originalOccupant = yield user_1.UserDAO.getById(this.res, userId).catch(err => reject(err));
            if (originalOccupant && originalOccupant.email) {
                if (this.id) {
                    database_1.Database.mongodb.collection(TicketDAO.collection_name)
                        .updateOne({ _id: this.id, occupantId: null }, { $set: { "occupantId": userId } }, { session: this.res.locals.session }).then((value) => __awaiter(this, void 0, void 0, function* () {
                        if (value.modifiedCount > 0) {
                            if (originalOccupant && originalOccupant.email) {
                                let notificationDao = new notification_1.NotificationDAO(this.res, {
                                    email: originalOccupant.email,
                                    title: "Ticket Purchased",
                                    message: `1 ticket purchased, for follow-up info, please visit: ${process.env.BASE_PRODUCTION_URI}/payment-info?ids=${this.id}`,
                                    recipientId: userId
                                });
                                yield notificationDao.create().catch(err => reject(err));
                                notificationDao.send().catch(err => console.log(err));
                            }
                            resolve(this);
                        }
                        else {
                            reject(new database_1.RequestError(`Ticket with id ${this.id} is not avaliable.`));
                            return;
                        }
                    }));
                }
                else {
                    reject(new database_1.RequestError(`${this.constructor.name}'s id is not initialized.`));
                    return;
                }
            }
            this._occupantId = new mongodb_1.ObjectId(userId);
            try {
                yield this.checkReference(true, new mongodb_1.ObjectId(userId));
            }
            catch (err) {
                reject(err);
                return;
            }
        }));
    }
    constructor(res, params) {
        super(res, params.doc && params.doc._id ? params.doc._id : undefined);
        this._securedBy = null;
        this._remark = null;
        this._occupantId = null;
        if (params.doc && params.doc._id) {
            this._eventId = params.doc.eventId;
            this._seatId = params.doc.seatId;
            this._occupantId = params.doc.occupantId;
            this._priceTierId = params.doc.priceTierId;
            this._securedBy = params.doc.securedBy;
            this._remark = params.doc.remark;
        }
        if (params.securedBy)
            this.securedBy = params.securedBy;
        if (params.remark)
            this.remark = params.remark;
    }
    static listByEventId(evnetId, param) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var cursor = database_1.Database.mongodb.collection(TicketDAO.collection_name).
                    aggregate(this.lookupQuery({ $match: { eventId: new mongodb_1.ObjectId(evnetId) } }, param));
                resolve((yield cursor.toArray()));
            }));
        });
    }
    static listSold(param) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var cursor = database_1.Database.mongodb.collection(TicketDAO.collection_name).
                    aggregate(this.lookupQuery({ $match: { occupantId: { $ne: null } } }, param));
                resolve((yield cursor.toArray()));
            }));
        });
    }
    static listByIds(ids, param) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var cursor = database_1.Database.mongodb.collection(TicketDAO.collection_name).
                    aggregate(this.lookupQuery({ $match: { _id: { $in: ids.map(id => new mongodb_1.ObjectId(id)) } } }, param));
                resolve((yield cursor.toArray()));
            }));
        });
    }
    static ofUser(userId, param) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var cursor = database_1.Database.mongodb.collection(TicketDAO.collection_name).
                    aggregate(this.lookupQuery({ $match: { occupantId: new mongodb_1.ObjectId(userId) } }, param));
                resolve((yield cursor.toArray()));
            }));
        });
    }
    static getWithDetailsById(id, param) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var cursor = database_1.Database.mongodb.collection(TicketDAO.collection_name).
                    aggregate(this.lookupQuery({ $match: { occupantId: new mongodb_1.ObjectId(id) } }, param));
                var docs = yield cursor.toArray();
                if (docs.length > 0) {
                    resolve(docs[0]);
                }
                else {
                    reject(new database_1.RequestError(`${this.name} has no instance with id ${id}.`));
                }
            }));
        });
    }
    static getById(res, id) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var doc = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).findOne({ _id: new mongodb_1.ObjectId(id) });
                if (doc) {
                    resolve(new TicketDAO(res, { doc: doc }));
                }
                reject(new database_1.RequestError(`${this.name} has no instance with id ${id}.`));
            }));
        });
    }
    static getByIds(res, ids) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
                    return new Promise((daoresolve, daoreject) => __awaiter(this, void 0, void 0, function* () {
                        var doc = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).findOne({ _id: new mongodb_1.ObjectId(id) });
                        if (doc) {
                            daoresolve(new TicketDAO(res, { doc: doc }));
                        }
                        daoreject(new database_1.RequestError(`${this.name} has no instance with id ${id}.`));
                    }));
                }))).then(daos => {
                    resolve(daos);
                });
            }));
        });
    }
    checkReference(checkIsSelling = false, checkQuotaForUserId, purchaseQuantity = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._eventId == undefined) {
                this.res.locals.RequestErrorList.push(new database_1.RequestError(`Ticket with id ${this._id} has no associate event.`));
                return null;
            }
            var event = yield event_1.EventDAO.getById(this.res, this._eventId.toString());
            if (event && event.startFirstRoundSellDate &&
                event.endFirstRoundSellDate &&
                event.startSecondRoundSellDate &&
                event.endSecondRoundSellDate &&
                event.shoppingCartSize != undefined && Number.isFinite(Number(event.shoppingCartSize)) &&
                event.firstRoundTicketQuota != undefined && Number.isFinite(Number(event.firstRoundTicketQuota)) &&
                event.secondRoundTicketQuota != undefined && Number.isFinite(Number(event.secondRoundTicketQuota))) {
                if (checkIsSelling) {
                    var isSelling = (event.startFirstRoundSellDate <= new Date() && event.endFirstRoundSellDate >= new Date()) ||
                        (event.startSecondRoundSellDate <= new Date() && event.endSecondRoundSellDate >= new Date());
                    if (!isSelling) {
                        this.res.locals.RequestErrorList.push(new database_1.RequestError(`Ticket of event with id ${this._eventId} doesn't exists is not selling.`));
                        return null;
                    }
                }
                let venueId = event.venueId;
                yield database_1.Database.mongodb.collection(priceTier_1.PriceTierDAO.collection_name).findOne({ _id: this._priceTierId }).then(instance => {
                    if (instance == null) {
                        this.res.locals.RequestErrorList.push(new database_1.RequestError(`Price Tier with id ${this._priceTierId} doesn't exists.`));
                    }
                });
                let seatDoc = yield database_1.Database.mongodb.collection(seat_1.SeatDAO.collection_name).findOne({ _id: this._seatId, venueId: venueId }).then(instance => {
                    if (instance == null) {
                        this.res.locals.RequestErrorList.push(new database_1.RequestError(`Seat with id ${this._seatId} in the same event venue with id ${venueId} doesn't exists.`));
                    }
                    return instance;
                });
                if (checkQuotaForUserId != undefined) {
                    var count = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).aggregate([
                        { $match: { occupantId: checkQuotaForUserId, eventId: this.eventId } }, { $count: "baught" }
                    ]).tryNext();
                    if (count != null && Number.isInteger(count.baught)) {
                        let quota = (event.startFirstRoundSellDate <= new Date() && event.endFirstRoundSellDate >= new Date()) ?
                            event.firstRoundTicketQuota : (event.startSecondRoundSellDate <= new Date() && event.endSecondRoundSellDate >= new Date()) ?
                            event.secondRoundTicketQuota :
                            0;
                        if (quota > -1 && count.baught + purchaseQuantity > quota) {
                            this.res.locals.RequestErrorList.push(new database_1.RequestError(`You have no more ticket quota for this show.`));
                        }
                    }
                }
                let userDoc = null;
                if (this._occupantId) {
                    userDoc = yield database_1.Database.mongodb.collection(user_1.UserDAO.collection_name).findOne({ _id: this._occupantId }).then(instance => {
                        if (instance == null) {
                            this.res.locals.RequestErrorList.push(new database_1.RequestError(`User with id ${this._seatId} doesn't exists.`));
                        }
                        return instance;
                    });
                }
                return { seat: seatDoc, user: userDoc };
            }
            else {
                if (event == null)
                    this.res.locals.RequestErrorList.push(new database_1.RequestError(`Event with id ${this._eventId} doesn't exists.`));
                if (!checkIsSelling)
                    return null;
                if (event.startFirstRoundSellDate == undefined || event.startFirstRoundSellDate > new Date())
                    this.res.locals.RequestErrorList.push(new database_1.RequestError(`The first round of ticket selling of event with id ${this._eventId} is not started yet.`));
                if (event.endFirstRoundSellDate == undefined || event.endFirstRoundSellDate < new Date())
                    this.res.locals.RequestErrorList.push(new database_1.RequestError(`The first round of selling of event with id ${this._eventId} was ended.`));
                if (event.startSecondRoundSellDate == undefined || event.startSecondRoundSellDate > new Date())
                    this.res.locals.RequestErrorList.push(new database_1.RequestError(`The second round of ticket selling of event with id ${this._eventId} is not started yet.`));
                if (event.endSecondRoundSellDate == undefined || event.endSecondRoundSellDate < new Date())
                    this.res.locals.RequestErrorList.push(new database_1.RequestError(`The second round of selling of event with id ${this._eventId} was ended.`));
                return null;
            }
        });
    }
    duplicationChecking() {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.Database.mongodb.collection(TicketDAO.collection_name).findOne({ eventId: this.eventId, seatId: this.seatId }).then(instance => {
                if (instance) {
                    this.res.locals.RequestErrorList.push(new database_1.RequestError(`Ticket with same event with id ${this.eventId} and seat with id ${this.seatId} already exists.`));
                }
            });
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.res.locals.session.startTransaction();
                try {
                    yield this.checkReference();
                    yield this.duplicationChecking();
                }
                catch (err) {
                    reject(err);
                    return;
                }
                var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).insertOne(this.Serialize(true), { session: this.res.locals.session });
                if (result.insertedId) {
                    resolve(this);
                }
                else {
                    reject(new database_1.RequestError(`Creation of ${this.constructor.name} failed with unknown reason.`));
                }
            }));
        });
    }
    static batchCreate(res, daos) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                res.locals.session.startTransaction();
                Promise.all(daos.map(dao => new Promise((daoresolve, daoreject) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield dao.checkReference();
                        yield dao.duplicationChecking();
                    }
                    catch (err) {
                        daoreject(err);
                        return;
                    }
                    try {
                        var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).insertOne(dao.Serialize(true), { session: res.locals.session });
                        if (result && result.insertedId) {
                            daoresolve(dao);
                        }
                        else {
                            daoreject(new database_1.RequestError(`Creation of ${dao.constructor.name} failed with unknown reason.`));
                        }
                    }
                    catch (err) {
                        console.log(err);
                        reject(new database_1.RequestError(`Please reduce the size of your batch request.`));
                    }
                })))).then(daos => {
                    resolve(daos);
                });
            });
        });
    }
    static batchUdatePriceTier(res, daos, priceTierId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                res.locals.session.startTransaction();
                Promise.all(daos.map(dao => new Promise((daoresolve, daoreject) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        dao.priceTierId = new mongodb_1.ObjectId(priceTierId);
                        yield dao.checkReference();
                    }
                    catch (err) {
                        daoreject(err);
                        return;
                    }
                    if (dao._id) {
                        try {
                            var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name)
                                .updateOne({ _id: dao._id }, { $set: dao.Serialize(true) }, { session: res.locals.session });
                            if (result) {
                                daoresolve(dao);
                            }
                            else {
                                daoreject(new database_1.RequestError(`Update of ${dao.constructor.name} failed with unknown reason.`));
                            }
                        }
                        catch (err) {
                            console.log(err);
                            reject(new database_1.RequestError(`Please reduce the size of your batch request.`));
                        }
                    }
                    else {
                        reject(new database_1.RequestError(`One of the ticket's id is not initialized.`));
                    }
                })))).then(daos => {
                    resolve(daos);
                });
            });
        });
    }
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (this._id == undefined) {
                    reject(new database_1.RequestError(`${this.constructor.name}'s id is not initialized.`));
                    return;
                }
                try {
                    yield this.checkReference();
                }
                catch (err) {
                    reject(err);
                    return;
                }
                var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).updateOne({ _id: new mongodb_1.ObjectId(this._id) }, { $set: this.Serialize(true) }, { session: this.res.locals.session });
                if (result.modifiedCount > 0) {
                    resolve(this);
                }
                else {
                    reject(new database_1.RequestError(`Update of ${this.constructor.name} with id ${this._id} failed with unknown reason.`));
                }
            }));
        });
    }
    static batchClaim(res, daos, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                res.locals.session.startTransaction();
                let originalOccupant = yield user_1.UserDAO.getById(res, userId).catch(err => reject(err));
                if (originalOccupant && originalOccupant.email) {
                    Promise.all(daos.map(dao => new Promise((daoresolve, daoreject) => __awaiter(this, void 0, void 0, function* () {
                        dao._occupantId = new mongodb_1.ObjectId(userId);
                        let info;
                        try {
                            info = yield dao.checkReference(true, new mongodb_1.ObjectId(userId), daos.length);
                        }
                        catch (err) {
                            daoreject(err);
                            return;
                        }
                        if (dao.id) {
                            try {
                                var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).updateOne({ _id: dao.id, occupantId: null }, { $set: { "occupantId": userId } }, { session: res.locals.session });
                                if (result && result.modifiedCount > 0) {
                                    daoresolve({ dao: dao, info: info ? info : undefined });
                                }
                                else {
                                    daoreject(new database_1.RequestError(`Ticket with id ${dao.id} is not avaliable.`));
                                }
                            }
                            catch (err) {
                                console.log(err);
                                reject(new database_1.RequestError(`Please reduce the size of your batch request.`));
                            }
                        }
                    })))).then((ticketDaoWithInfo) => __awaiter(this, void 0, void 0, function* () {
                        var _a, _b;
                        if (originalOccupant && originalOccupant.email) {
                            let notificationDao = new notification_1.NotificationDAO(res, {
                                title: "Ticket Purchased",
                                email: originalOccupant.email,
                                message: `Dear ${(_b = (_a = ticketDaoWithInfo[0].info) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.fullname}\n` +
                                    `${ticketDaoWithInfo.length} ticket purchased:\n` +
                                    ticketDaoWithInfo.map(withInfo => { var _a, _b, _c, _d; return ((_b = (_a = withInfo.info) === null || _a === void 0 ? void 0 : _a.seat) === null || _b === void 0 ? void 0 : _b.row) + ((_d = (_c = withInfo.info) === null || _c === void 0 ? void 0 : _c.seat) === null || _d === void 0 ? void 0 : _d.no); }).join(", ") +
                                    `\nFor follow-up info, please visit: ${process.env.BASE_PRODUCTION_URI}/payment-info?`
                                    + ticketDaoWithInfo.map(withInfo => { var _a; return 'ids=' + ((_a = withInfo.dao._id) === null || _a === void 0 ? void 0 : _a.toString()); }).join('&') + `&userId=${userId}`,
                                recipientId: userId
                            });
                            yield notificationDao.create().catch(err => reject(err));
                            notificationDao.send().catch(err => console.log(err));
                        }
                        resolve(ticketDaoWithInfo.map(withInfo => withInfo.dao));
                    }));
                }
                else {
                    if (originalOccupant instanceof Object && originalOccupant.email == undefined) {
                        reject(new database_1.RequestError(`User with id ${userId} has an occupant without email information.`));
                    }
                    if (originalOccupant)
                        reject(new database_1.RequestError(`User id ${userId} not found.`));
                    return;
                }
            }));
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (this._id == undefined) {
                    reject(new database_1.RequestError(`${this.constructor.name}'s id is not initialized.`));
                    return;
                }
                var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).deleteOne({ _id: new mongodb_1.ObjectId(this._id) }, { session: this.res.locals.session });
                if (result.deletedCount > 0) {
                    resolve(this);
                }
                else {
                    reject(new database_1.RequestError(`Deletation of ${this.constructor.name} with id ${this._id} failed with unknown reason.`));
                }
            }));
        });
    }
    static batchDelete(res, daos) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                res.locals.session.startTransaction();
                Promise.all(daos.filter(dao => dao.id != undefined).map(dao => new Promise((daoresolve, daoreject) => __awaiter(this, void 0, void 0, function* () {
                    if (dao.occupantId != null) {
                        daoreject(new database_1.RequestError(`Deletation of ${dao.constructor.name} with id ${dao.id} failed as it has occupant.`));
                    }
                    try {
                        var result = yield database_1.Database.mongodb.collection(TicketDAO.collection_name).deleteOne(dao.Serialize(true), { session: res.locals.session });
                        if (result && result.deletedCount > 0) {
                            daoresolve(dao);
                        }
                        else {
                            daoreject(new database_1.RequestError(`Deletation of ${dao.constructor.name} with id ${dao.id} failed with unknown reason.`));
                        }
                    }
                    catch (err) {
                        console.log(err);
                        reject(new database_1.RequestError(`Please reduce the size of your batch request.`));
                    }
                })))).then(daos => {
                    resolve(daos);
                });
            });
        });
    }
}
exports.TicketDAO = TicketDAO;
TicketDAO.collection_name = "tickets";
TicketDAO.lookupQuery = (condition, param) => {
    return [
        ...[
            condition,
            {
                $lookup: {
                    from: event_1.EventDAO.collection_name,
                    localField: "eventId",
                    foreignField: "_id",
                    as: "event",
                }
            },
            {
                $lookup: {
                    from: seat_1.SeatDAO.collection_name,
                    localField: "seatId",
                    foreignField: "_id",
                    as: "seat",
                }
            },
            {
                $lookup: {
                    from: priceTier_1.PriceTierDAO.collection_name,
                    localField: "priceTierId",
                    foreignField: "_id",
                    as: "priceTier",
                }
            },
        ],
        ...param.checkIfBelongsToUser ? [
            { $set: { 'belongsToUser': { $cond: { if: { $eq: ["$occupantId", new mongodb_1.ObjectId(param.checkIfBelongsToUser)] }, then: true, else: false } } } },
        ] : [],
        ...param.showOccupant ? [
            {
                $lookup: {
                    from: user_1.UserDAO.collection_name,
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
    ];
};
