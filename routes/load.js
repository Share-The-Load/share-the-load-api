import log from "../utils/log.js";

const logger = log.createLogger("share-the-load-routes-load");

export default function (app, dbConn) {
    const loadService = app.ctx.loadService;

    app.post("/schedule", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const userId = req.auth.userId;
            const loads = req.body.loads.map(load => load.loadType);
            const urgent = req.body.urgent;

            logger.info(`Scheduling loads for user ${userId}: ${loads}`);

            await loadService.scheduleLoad(userId, loads, urgent);

            res.status(200).json({ status: "success" });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });
}
