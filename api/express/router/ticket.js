"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ticket = void 0;
const express_1 = require("express");
const ticket_1 = require("../dao/ticket");
const database_1 = require("../dao/database");
var Ticket;
(function (Ticket) {
    function RouterFactory() {
        var ticket = (0, express_1.Router)();
        var shouldShowOccupant = (session) => {
            if (session && session.user)
                return session.user.hasAdminRight || session.user.isCustomerSupport;
            return false;
        };
        ticket.use((req, res, next) => {
            if (req.method == 'PATCH' && req.query.buy != undefined) {
                return next();
            }
            if (req.method == 'PATCH' && (req.query.void != undefined || req.query.verify != undefined) && req.session["user"]?.isCustomerSupport == true) {
                return next();
            }
            else if (req.method != 'GET' && req.session["user"]?.hasAdminRight != true) {
                res.status(401).json({ success: false, reason: "Unauthorized access" });
            }
            else {
                next();
            }
        });
        ticket.get("/", async (req, res, next) => {
            if (req.query.eventId && typeof req.query.eventId == "string") {
                ticket_1.TicketDAO.listByEventId(req.query.eventId, { showOccupant: shouldShowOccupant(req.session) }).then(result => {
                    next({ success: true, data: result });
                }).catch((error) => next(error));
            }
            else if (req.query.my != undefined && req.session['user'] && req.session['user']._id) {
                ticket_1.TicketDAO.ofUser(req.session['user']._id, { showOccupant: shouldShowOccupant(req.session) }).then(result => {
                    next({ success: true, data: result });
                }).catch((error) => next(error));
            }
            else if (req.query.sold != undefined) {
                ticket_1.TicketDAO.listSold({ showOccupant: shouldShowOccupant(req.session) }).then(result => {
                    next({ success: true, data: result });
                }).catch((error) => next(error));
            }
            else if (req.query.list != undefined && req.query.userId && typeof req.query.userId === "string") {
                let ids;
                try {
                    ids = (JSON.parse(req.query.list)).filter((value) => typeof value == "string");
                }
                catch (e) {
                }
                if (req.session["user"] != null && req.session["user"]._id && req.session["user"]._id != req.query.userId) {
                    next(new database_1.RequestError("This reveals information of another user"));
                    return;
                }
                if (ids) {
                    ticket_1.TicketDAO.listByIds(ids, {
                        showOccupant: false,
                        checkIfBelongsToUser: req.query.userId
                    }).then(result => {
                        next({ success: true, data: result });
                    }).catch((error) => next(error));
                }
                else {
                    next(new database_1.RequestError("unregconized list query"));
                }
            }
        });
        ticket.get("/:ticketId", async (req, res, next) => {
            ticket_1.TicketDAO.getWithDetailsById(req.params.ticketId, { showOccupant: shouldShowOccupant(req.session) }).then(result => {
                next({ success: true, data: result });
            }).catch((error) => { next(error); });
        });
        ticket.post("/", async (req, res, next) => {
            if (req.query.create != undefined) {
                if (req.query.batch != undefined && req.body.tickets && Array.isArray(req.body.tickets)) {
                    var daos = req.body.tickets.map((t) => {
                        var dao = new ticket_1.TicketDAO(res, {});
                        dao.eventId = t.eventId;
                        dao.seatId = t.seatId;
                        dao.priceTierId = t.priceTierId;
                        dao.securedBy = "";
                        return dao;
                    });
                    ticket_1.TicketDAO.batchCreate(res, daos).then((tickets) => {
                        next({ success: true, data: tickets.map(ticket => ticket.Hydrated()) });
                    }).catch((error) => next(error));
                }
                else if (req.body.eventId && typeof req.body.eventId == "string" &&
                    req.body.seatId && typeof req.body.seatId == "string" &&
                    req.body.priceTierId && typeof req.body.priceTierId == "string") {
                    var dao = new ticket_1.TicketDAO(res, {});
                    dao.securedBy = "";
                    var promises = [];
                    dao.eventId = req.body.eventId;
                    dao.seatId = req.body.seatId;
                    dao.priceTierId = req.body.priceTierId;
                    dao.create().then((value) => {
                        next({ success: true });
                    }).catch((error) => next(error));
                }
            }
        });
        ticket.patch("", async (req, res, next) => {
            if (req.query.batch != undefined && req.body.ticketIds && Array.isArray(req.body.ticketIds)) {
                if (req.query.buy != undefined) {
                    if (req.session['user'] && req.session['user']._id) {
                        ticket_1.TicketDAO.getByIds(res, req.body.ticketIds).then(daos => ticket_1.TicketDAO.batchClaim(res, daos, req.session['user']._id)).then((tickets) => {
                            next({ success: true, data: tickets.map(ticket => ticket.Hydrated()) });
                        }).catch((error) => next(error));
                    }
                    else {
                        next(new database_1.RequestError("Buying ticket requires a user login"));
                    }
                }
                else if (typeof req.query.priceTier === "string") {
                    ticket_1.TicketDAO.getByIds(res, req.body.ticketIds).then(daos => {
                        if (typeof req.query.priceTier === "string") {
                            return ticket_1.TicketDAO.batchUdatePriceTier(res, daos, req.query.priceTier);
                        }
                        else {
                            next(new database_1.RequestError(`${req.query.priceTier} is not of type string`));
                            return [];
                        }
                    }).then((tickets) => {
                        next({ success: true, data: tickets.map(ticket => ticket.Hydrated()) });
                    }).catch((error) => next(error));
                }
            }
        });
        ticket.patch("/:ticketId", async (req, res, next) => {
            if (req.query.buy != undefined) {
                if (req.session['user'] && req.session['user']._id) {
                    ticket_1.TicketDAO.getById(res, req.params.ticketId).then(dao => dao.claim(req.session['user']._id)).then((value) => {
                        next({ success: true });
                    }).catch((error) => next(error));
                }
                else {
                    next(new database_1.RequestError("Buying ticket requires a user login"));
                }
            }
            if (req.query.verify != undefined &&
                (req.body.securedBy != undefined || req.body.securedBy == null || typeof req.body.securedBy == "string") &&
                (req.body.remark == undefined || req.body.remark == null || typeof req.body.remark == "string")) {
                ticket_1.TicketDAO.getById(res, req.params.ticketId).then(dao => {
                    dao.securedBy = req.body.securedBy;
                    dao.remark = req.body.remark;
                    return dao.update();
                }).then((value) => {
                    next({ success: true });
                }).catch((error) => next(error));
            }
            else if (req.query.void != undefined) {
                ticket_1.TicketDAO.getById(res, req.params.ticketId).then(dao => dao.void(req.session?.user?.username)).then((value) => {
                    next({ success: true });
                }).catch((error) => next(error));
            }
        });
        ticket.delete("/", async (req, res, next) => {
            if (req.query.batch != undefined && req.body.ticketIds && Array.isArray(req.body.ticketIds)) {
                ticket_1.TicketDAO.getByIds(res, req.body.ticketIds).then(daos => ticket_1.TicketDAO.batchDelete(res, daos)).then((tickets) => {
                    next({ success: true, data: tickets.map(ticket => ticket.Hydrated()) });
                }).catch((error) => next(error));
            }
        });
        ticket.delete("/:ticketId", async (req, res, next) => {
            ticket_1.TicketDAO.getById(res, req.params.ticketId).then(dao => dao.delete()).then((value) => {
                next({ success: true });
            }).catch((error) => { next(error); });
        });
        return ticket;
    }
    Ticket.RouterFactory = RouterFactory;
    ;
})(Ticket = exports.Ticket || (exports.Ticket = {}));
