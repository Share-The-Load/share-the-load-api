import { Op, fn, col, literal } from "sequelize";
import log from "../utils/log.js";

const logger = log.createLogger('sharetheload-routes-insights');

export default function (app, dbConn) {

    app.get("/insights", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }

            const userId = req.auth.userId;
            const user = await dbConn.models.user.findByPk(userId, { raw: true });

            if (!user || !user.group_id) {
                return res.status(400).json({ error: "User is not in a group" });
            }

            const groupId = user.group_id;

            // Total loads for the user
            const userTotalLoads = await dbConn.models.load.count({
                where: { user_id: userId },
            });

            // Total loads for the group
            const groupTotalLoads = await dbConn.models.load.count({
                where: { group_id: groupId },
            });

            // Loads by type for the user
            const userLoadsByType = await dbConn.models.load.findAll({
                where: { user_id: userId },
                attributes: [
                    'load_type',
                    [fn('COUNT', col('load_id')), 'count'],
                ],
                group: ['load_type'],
                raw: true,
            });

            // Loads by type for the group
            const groupLoadsByType = await dbConn.models.load.findAll({
                where: { group_id: groupId },
                attributes: [
                    'load_type',
                    [fn('COUNT', col('load_id')), 'count'],
                ],
                group: ['load_type'],
                raw: true,
            });

            // Total time laundering (in minutes) for the user
            const userTimeResult = await dbConn.models.load.findAll({
                where: { user_id: userId },
                attributes: [
                    [fn('SUM', literal('TIMESTAMPDIFF(MINUTE, start_time, end_time)')), 'totalMinutes'],
                ],
                raw: true,
            });
            const userTotalMinutes = userTimeResult[0]?.totalMinutes || 0;

            // Total time laundering (in minutes) for the group
            const groupTimeResult = await dbConn.models.load.findAll({
                where: { group_id: groupId },
                attributes: [
                    [fn('SUM', literal('TIMESTAMPDIFF(MINUTE, start_time, end_time)')), 'totalMinutes'],
                ],
                raw: true,
            });
            const groupTotalMinutes = groupTimeResult[0]?.totalMinutes || 0;

            // Loads per member in the group
            const loadsPerMember = await dbConn.models.load.findAll({
                where: { group_id: groupId },
                attributes: [
                    'user_id',
                    [fn('COUNT', col('load_id')), 'count'],
                ],
                group: ['user_id'],
                include: [{
                    model: dbConn.models.user,
                    attributes: ['username', 'avatar_id'],
                }],
                raw: true,
                nest: true,
            });

            res.json({
                user: {
                    totalLoads: userTotalLoads,
                    totalMinutes: parseInt(userTotalMinutes) || 0,
                    loadsByType: userLoadsByType.map(l => ({
                        type: l.load_type,
                        count: parseInt(l.count),
                    })),
                },
                group: {
                    totalLoads: groupTotalLoads,
                    totalMinutes: parseInt(groupTotalMinutes) || 0,
                    loadsByType: groupLoadsByType.map(l => ({
                        type: l.load_type,
                        count: parseInt(l.count),
                    })),
                    loadsPerMember: loadsPerMember.map(m => ({
                        username: m.user?.username || "Unknown",
                        avatar_id: m.user?.avatar_id || 1,
                        count: parseInt(m.count),
                    })),
                },
            });
        } catch (error) {
            logger.error("Error fetching insights: " + error.message);
            res.status(500).json({ error: "Failed to fetch insights" });
        }
    });
}
