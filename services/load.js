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
        const groupId = profile.group_id;
        const loadTime = profile.load_time;


        let findAllFutureGroupLoads = await this.dbConn.models.load.findAll({
            where: {
                group_id: groupId,
                end_time: {
                    [Op.gte]: new Date(),
                },
            },
            raw: true,
        });

        for (const load of loads) {
            //find a time for each load out to 6 days in advance
            //if not urgent, start tomorrow
            //if urgent, start today
            for (let daysAhead = urgent ? 0 : 1; daysAhead < 6; daysAhead++) {
                const findTimeResult = this.findTime(daysAhead, profile.preferences, loadTime, findAllFutureGroupLoads)
                if (findTimeResult) {
                    logger.info(`Scheduling load for user ${userId} in group ${groupId} at ${findTimeResult.start_time} for ${loadTime} minutes`);
                    const newLoad = await this.dbConn.models.load.create({
                        user_id: userId,
                        group_id: groupId,
                        load_type: load,
                        start_time: findTimeResult.start_time,
                        end_time: findTimeResult.end_time,
                    });
                    findAllFutureGroupLoads.push(newLoad.dataValues);
                    break;
                }
            }
        }

    }

    findTime(daysAhead, preferences, loadTime, findAllFutureGroupLoads) {
        const day = moment().add(daysAhead, 'd').format('ddd');
        const preference = preferences.find(p => p.day === day);

        //find the amount of 30 minute blocks in the preference
        const startTime = moment(preference.start_time, 'HH:mm:ss').add(daysAhead, 'd')
        const endTime = moment(preference.end_time, 'HH:mm:ss').add(daysAhead, 'd')

        //find the amount of 30 minute blocks in the preference
        const blocks = Math.floor(moment.duration(endTime.diff(startTime)).asMinutes() / 30)

        //go through each available block and check if it is available
        for (let block = 0; block < blocks; block++) {

            //calculate the start and end time of the load
            const start_time = moment(preference.start_time, 'HH:mm:ss').add(daysAhead, 'd').add(block * 30, 'm').utc()
            const end_time = moment(preference.start_time, 'HH:mm:ss').add(daysAhead, 'd').add(block * 30, 'm').add(loadTime, 'm').utc()

            //find if the block is taken
            //go through the future loads and check if the block is taken
            //need to check if the start time is before the end time of the future load
            //and if the end time is after the start time of the future load
            if (findAllFutureGroupLoads.some(load => start_time.isBefore(moment.utc(load.end_time)) && end_time.isAfter(moment.utc(load.start_time)))) {
                logger.info(`Block taken`, start_time, end_time)
                continue;
            }
            //check if the end time is after the end of the preference
            if (end_time.isAfter(endTime)) {
                logger.info('Cant schedule after end of preference', end_time, endTime)
                continue;
            }
            logger.info(`Block available`, start_time, end_time)
            return { start_time, end_time };
        }
        logger.info(`No blocks available for ${day}`)
        return false;
    }

}

export default LoadService;