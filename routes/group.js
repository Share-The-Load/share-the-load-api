import { Op } from "sequelize";
import slogans from "../constants/slogans.js";
import { hashPassword, checkPassword } from "../utils/passwordFunctions.js";
import log from "../utils/log.js";
import moment from "moment";
const logger = log.createLogger('sharetheload-routes-group');

const LOAD_DAYS = 6;

export default function (app, dbConn) {

    app.get("/groups/:name", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const name = req.params.name;
        const groups = await dbConn.models.group.findAll({
            where: {
                name: {
                    [Op.like]: name + '%'
                },
            },
            attributes: ['group_id', 'name', 'slogan', 'passcode', 'owner_id', 'avatar_id'],
            raw: true
        }
        );
        const addNumberOfMembers = async (group) => {
            const numberOfMembers = await dbConn.models.user.count({
                where: {
                    group_id: group.group_id
                }
            });
            group.numberOfMembers = numberOfMembers;
        }

        const addOwner = async (group) => {
            const owner = await dbConn.models.user.findByPk(group.owner_id, {
                attributes: ['user_id', 'username'],
                raw: true
            });
            group.ownerName = owner.username;
        }

        //remove passcode from response and add a boolean to indicate if there is a passcode
        for (const group of groups) {
            await addNumberOfMembers(group);
            await addOwner(group);
            group.hasPasscode = group.passcode ? true : false;
            delete group.passcode;
            delete group.owner_id;
        }
        res.status(200).json({ groups });
    });

    app.post("/create-group", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const ownerId = req.auth.userId;
        const { name, passcode } = req.body;

        //find if the name is already taken
        const groupExists = await dbConn.models.group.findOne({
            where: {
                name
            }
        });
        if (groupExists) {
            logger.error("Group name already taken");
            return res.status(409).send("Group name already taken");
        }

        const hashedPasscode = await hashPassword(passcode);

        const randomSlogan = slogans[Math.floor(Math.random() * slogans.length)];
        const randomAvatar = Math.floor(Math.random() * 6) + 1;

        const group = await dbConn.models.group.create({
            name,
            passcode: hashedPasscode,
            slogan: randomSlogan,
            owner_id: ownerId,
            avatar_id: randomAvatar

        });
        const updateUser = await dbConn.models.user.update({
            group_id: group.group_id
        }, {
            where: {
                user_id: ownerId
            }
        });

        const newGroup = await dbConn.models.group.findByPk(group.group_id, {
            attributes: ['group_id', 'name', 'slogan'],
            raw: true

        });

        res.status(200).json({ group: newGroup });
    });

    app.post("/join-group", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const userId = req.auth.userId;
        const { groupId, passcode } = req.body;

        const group = await dbConn.models.group.findByPk(groupId, {
            attributes: ['group_id', 'name', 'slogan', 'passcode'],
            raw: true
        });

        if (!group) {
            logger.error("Group not found");
            return res.status(404).send("Group not found");
        }
        if (group.passcode) {
            const passcodeMatch = await checkPassword(group.passcode, passcode);
            if (!passcodeMatch) {
                logger.error("Invalid passcode for group " + groupId);
                return res.status(403).send("Invalid passcode");
            }
            //remove passcode from response
            delete group.passcode;
        }
        const updateUser = await dbConn.models.user.update({
            group_id: group.group_id
        }, {
            where: {
                user_id: userId
            }
        });

        //remove passcode from response
        await delete group.passcode;
        res.status(200).json({ group });
    });

    app.get("/group-details/:id", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const groupId = req.params.id;
        const group = await dbConn.models.group.findByPk(groupId, {
            attributes: ['group_id', 'owner_id', 'name', 'slogan', 'created_at', 'avatar_id', 'passcode'],
            raw: true
        });

        if (!group) {
            logger.error("Group not found");
            return res.status(404).send("Group not found");
        }
        const addNumberOfMembers = async (group) => {
            const numberOfMembers = await dbConn.models.user.count({
                where: {
                    group_id: group.group_id
                }
            });
            group.numberOfMembers = numberOfMembers;
        }

        const addOwner = async (group) => {
            const owner = await dbConn.models.user.findByPk(group.owner_id, {
                attributes: ['user_id', 'username'],
                raw: true
            });
            group.ownerName = owner.username;
        }

        const addMembers = async (group) => {
            const members = await dbConn.models.user.findAll({
                where: {
                    group_id: group.group_id
                },
                attributes: ['user_id', 'username', 'avatar_id'],
                raw: true
            });
            const owner = members.find(member => member.user_id === group.owner_id);
            owner.isOwner = true;
            for (const member of members) {
                const totalLoads = await dbConn.models.load.count({
                    where: {
                        user_id: member.user_id,
                    },
                });
                member.loads = totalLoads;
            }
            group.members = members;
        }

        const addTotalLoads = async (group) => {
            const totalLoads = await dbConn.models.load.count({
                where: {
                    group_id: group.group_id,
                },
            });
            group.totalLoads = totalLoads;
        }

        await addNumberOfMembers(group);
        await addOwner(group);
        await addMembers(group);
        await addTotalLoads(group);

        //remove passcode from response and add a boolean to indicate if there is a passcode
        group.hasPasscode = group.passcode ? true : false;
        delete group.passcode;

        res.status(200).json({ group });
    });

    app.post("/leave-group", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const userId = req.auth.userId;
        const user = await dbConn.models.user.findByPk(userId);

        const group = await dbConn.models.group.findByPk(user.group_id);
        if (!group) {
            logger.error("User not in a group");
            return res.status(404).send("User not in a group");
        }

        const groupMembers = await dbConn.models.user.findAll({
            where: {
                group_id: group.group_id
            }
        });

        if (groupMembers.length === 1) {
            //delete group
            logger.info("Group " + group.group_id + " deleted");
            await group.destroy();
        }

        //user is the owner. need to transfer ownership
        if (group.owner_id === userId) {
            logger.info("User " + userId + " left group. Transferring ownership");
            const newOwner = groupMembers.find(member => member.user_id !== userId);
            group.owner_id = newOwner.user_id;
            await group.save();
        }


        user.group_id = null;
        await user.save();
        logger.info("User " + userId + " left group");
        res.status(200).json({ status: "success" });
    });

    app.post("/remove-member", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const ownerId = req.auth.userId;

        const group = await dbConn.models.group.findOne({
            where: {
                owner_id: ownerId
            }
        });
        if (!group) {
            logger.error("Group not found");
            return res.status(404).send("Group not found");
        }
        const { memberId } = req.body;
        const member = await dbConn.models.user.findByPk(memberId);

        member.group_id = null;
        await member.save();
        logger.info("User " + memberId + " removed from group " + group.group_id);
        res.status(200).json({ status: "success" });
    })

    app.get("/get-slogan", async (req, res) => {
        const randomSlogan = slogans[Math.floor(Math.random() * slogans.length)];
        logger.info("Grabbed new Slogan: " + randomSlogan);
        res.status(200).json({ slogan: randomSlogan });
    })

    app.get("/group-loads", async (req, res) => {
        console.log(`❗️❗️❗️ req`, req.auth)
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const userId = req.auth.userId;
            const profile = await dbConn.models.user.findOne({
                where: {
                    user_id: userId,
                },
            });
            const groupId = profile.group_id;
            const loads = await dbConn.models.load.findAll({
                where: {
                    group_id: groupId,
                    end_time: {
                        [Op.gte]: new Date(),
                    },
                },
                include: [
                    { model: dbConn.models.user }
                ]
            });

            const formattedLoads = loads.map(load => {
                return {
                    load_id: load.load_id,
                    start_time: load.start_time,
                    end_time: load.end_time,
                    load_type: load.load_type,
                    loadMember: {
                        user_id: load.user.user_id,
                        username: load.user.username,
                        avatar_id: load.user.avatar_id
                    }
                }
            });
            const loadDays = [];
            for (let i = 0; i < LOAD_DAYS; i++) {
                const day = moment().add(i, 'days').format("ddd, MMM Do");
                loadDays.push({ day, loads: [] });
            }
            formattedLoads.forEach(load => {
                const foundDay = loadDays.find(day => day.day === moment(load.start_time).format("ddd, MMM Do"))
                if (foundDay) {
                    foundDay.loads.push(load);
                }
            });
            res.send({ days: loadDays });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/edit-group", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const userId = req.auth.userId;
        const { name, slogan, avatar_id, passcode } = req.body;

        const user = await dbConn.models.user.findByPk(userId);

        const group = await dbConn.models.group.findOne({
            where: {
                group_id: user.group_id
            }
        });

        if (group.owner_id !== userId) {
            logger.error("Not the owner of the group. Can't edit");
            return res.status(401).send("Unauthorized");
        }

        if (passcode) {
            const hashedPasscode = await hashPassword(passcode);
            group.passcode = hashedPasscode;
        }

        group.name = name;
        group.slogan = slogan;
        group.avatar_id = avatar_id;

        await group.save();

        res.status(200).json({ status: "success" });
    });

    app.post("/remove-passcode", async (req, res) => {
        if (!req.auth) {
            return res.status(401).send("Unauthorized");
        }
        const userId = req.auth.userId;

        const user = await dbConn.models.user.findByPk(userId);

        const group = await dbConn.models.group.findOne({
            where: {
                group_id: user.group_id
            }
        });

        if (group.owner_id !== userId) {
            logger.error("Not the owner of the group. Can't edit");
            return res.status(401).send("Unauthorized");
        }

        group.passcode = null;

        await group.save();

        logger.info("Passcode removed from group " + group.group_id);

        res.status(200).json({ status: "success" });
    });
}