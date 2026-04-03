import log from "../utils/log.js";
import { Op } from "sequelize";
import moment from "moment";

const logger = log.createLogger('sharetheload-services-load');


class LoadService {
    constructor(dbConn) {
        this.dbConn = dbConn;
    }

    async scheduleLoad(userId, loads, urgent) {
        const profile = await this.dbConn.models.user.findOne({
            where: {
                user_id: userId,
            },
            include: [
                {
                    model: this.dbConn.models.preference,
                    raw: true,
                },
            ],
        });

        if (!profile) {
            throw new Error("User not found");
        }

        if (!profile.group_id) {
            throw new Error("User is not in a group");
        }

        if (!profile.load_time) {
            throw new Error("User has no load time configured");
        }

        const groupId = profile.group_id;
        const loadTime = profile.load_time;

        let futureGroupLoads = await this.dbConn.models.load.findAll({
            where: {
                group_id: groupId,
                end_time: {
                    [Op.gte]: new Date(),
                },
            },
            raw: true,
        });

        const scheduledLoads = [];
        const failedLoads = [];

        for (const load of loads) {
            let scheduled = false;
            for (let daysAhead = urgent ? 0 : 1; daysAhead < 6; daysAhead++) {
                const findTimeResult = this.findTime(daysAhead, profile.preferences, loadTime, futureGroupLoads);
                if (findTimeResult) {
                    logger.info(`Scheduling load for user ${userId} in group ${groupId} at ${findTimeResult.start_time} for ${loadTime} minutes`);
                    const newLoad = await this.dbConn.models.load.create({
                        user_id: userId,
                        group_id: groupId,
                        load_type: load,
                        start_time: findTimeResult.start_time,
                        end_time: findTimeResult.end_time,
                    });
                    futureGroupLoads.push(newLoad.dataValues);
                    scheduledLoads.push(load);
                    scheduled = true;
                    break;
                }
            }
            if (!scheduled) {
                logger.info(`Could not find available time slot for load type: ${load}`);
                failedLoads.push(load);
            }
        }

        return { scheduledLoads, failedLoads };
    }

    async deleteLoad(userId, loadId) {
        const load = await this.dbConn.models.load.findOne({
            where: {
                load_id: loadId,
            },
        });

        if (!load) {
            throw new Error("Load not found");
        }

        if (load.user_id !== userId) {
            throw new Error("Unauthorized");
        }

        await load.destroy();
    }

    findTime(daysAhead, preferences, loadTime, futureGroupLoads) {
        const day = moment().add(daysAhead, 'd').format('ddd');
        const preference = preferences.find(p => p.day === day);

        if (!preference) {
            logger.info(`No preference set for ${day}, skipping`);
            return false;
        }

        const prefStart = moment(preference.start_time, 'HH:mm:ss').add(daysAhead, 'd');
        const prefEnd = moment(preference.end_time, 'HH:mm:ss').add(daysAhead, 'd');

        const blocks = Math.floor(moment.duration(prefEnd.diff(prefStart)).asMinutes() / 30);

        if (blocks <= 0) {
            logger.info(`Preference window too small for ${day}`);
            return false;
        }

        for (let block = 0; block < blocks; block++) {
            const start_time = moment(prefStart).add(block * 30, 'm');
            const end_time = moment(start_time).add(loadTime, 'm');

            // Check if block is in the past
            if (start_time.isBefore(moment())) {
                continue;
            }

            // Check if load extends past the preference window
            if (end_time.isAfter(prefEnd)) {
                logger.info(`Remaining window too small for ${day}, moving to next day`);
                break;
            }

            // Check for overlap with existing loads (compare in same timezone)
            const startUtc = moment.utc(start_time);
            const endUtc = moment.utc(end_time);
            const hasConflict = futureGroupLoads.some(load =>
                startUtc.isBefore(moment.utc(load.end_time)) && endUtc.isAfter(moment.utc(load.start_time))
            );

            if (hasConflict) {
                logger.info(`Block taken: ${start_time.format()} - ${end_time.format()}`);
                continue;
            }

            logger.info(`Block available: ${start_time.format()} - ${end_time.format()}`);
            return { start_time: start_time.utc().toDate(), end_time: end_time.utc().toDate() };
        }

        logger.info(`No blocks available for ${day}`);
        return false;
    }

}

export default LoadService;