import { Request, Response, Router } from "express";
import * as Express from "express-serve-static-core"
import { Database, RequestError } from "../dao/database";
import { VenueDAO, sectionType, sectionTypeCheck } from "../dao/venue";
export namespace Venue {
    export function RouterFactory(): Express.Router {
        var venue = Router()

        venue.get("/", async (req: Request, res: Response, next) => {
            if (req.query.list != undefined) {
                VenueDAO.listAll().then(result => {
                    res.json({ success: true, data: result.map(dao => dao.Hydrated()) })
                }).catch((error) => next(error))
            }
        })
        venue.get("/:venueId", async (req: Request, res: Response, next): Promise<any> => {
            VenueDAO.getById(req.params.venueId).then(result => {
                if (result) res.json({ success: true, data: result.Hydrated() });
            }).catch((error) => next(error))
        })

        venue.post("/", async (req: Request, res: Response, next): Promise<any> => {
            if (req.query.create != undefined && req.body.venuename && req.body.sections) {
                if (req.body.sections.filter((s: sectionType) => !sectionTypeCheck(s)).length > 0)
                    return next(new RequestError("Requested sections is not in correct format"))
                var dao = new VenueDAO({
                    venuename: req.body.venuename,
                    sections: req.body.sections
                })
                dao.create().then((value) => {
                    res.json({ success: true })
                }).catch((error) => next(error))
            }
        })

        venue.patch("/:venueId", async (req: Request, res: Response, next): Promise<any> => {
            if (req.body.venuename) {
                if (req.body.sections.filter((s: sectionType) => !sectionTypeCheck(s)).length > 0)
                    return next(new RequestError("Requested sections is not in correct format"))
                VenueDAO.getById(req.params.venueId).then(dao => {
                    dao.venuename = req.body.venuename
                    dao.sections = req.body.sections
                    return dao.update()
                }).then((value) => {
                    res.json({ success: true })
                }).catch((error) => next(error))
            }
        })

        venue.delete("/:venueId", async (req: Request, res: Response, next): Promise<any> => {
            VenueDAO.getById(req.params.venueId).then(dao => dao.delete()).then((value) => {
                res.json({ success: true })
            }).catch((error) => next(error))
        })
        return venue
    };
}