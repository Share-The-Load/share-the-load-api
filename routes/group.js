import crypto from "crypto";
import { Op } from "sequelize";
import slogans from "../constants/slogans.js";
import { hashPassword, checkPassword } from "../utils/passwordFunctions.js";
import log from "../utils/log.js";
import moment from "moment";
const logger = log.createLogger('sharetheload-routes-group');

const LOAD_DAYS = 6;

export default function (app, dbConn) {

    app.get("/groups/:name", async (req, res) => {
        try {
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
            });

            for (const group of groups) {
                const numberOfMembers = await dbConn.models.user.count({
                    where: { group_id: group.group_id }
                });
                group.numberOfMembers = numberOfMembers;

                const owner = await dbConn.models.user.findByPk(group.owner_id, {
                    attributes: ['user_id', 'username'],
                    raw: true
                });
                group.ownerName = owner.username;

                group.hasPasscode = !!group.passcode;
                delete group.passcode;
                delete group.owner_id;
            }
            res.status(200).json({ groups });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/create-group", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const ownerId = req.auth.userId;
            const { name, passcode } = req.body;

            const groupExists = await dbConn.models.group.findOne({
                where: { name }
            });
            if (groupExists) {
                logger.error("Group name already taken");
                return res.status(409).send("Group name already taken");
            }

            const hashedPasscode = passcode ? await hashPassword(passcode) : null;

            const randomSlogan = slogans[Math.floor(Math.random() * slogans.length)];
            const randomAvatar = Math.floor(Math.random() * 6) + 1;

            const group = await dbConn.models.group.create({
                name,
                passcode: hashedPasscode,
                slogan: randomSlogan,
                owner_id: ownerId,
                avatar_id: randomAvatar
            });

            await dbConn.models.user.update(
                { group_id: group.group_id },
                { where: { user_id: ownerId } }
            );

            const newGroup = await dbConn.models.group.findByPk(group.group_id, {
                attributes: ['group_id', 'name', 'slogan'],
                raw: true
            });

            res.status(200).json({ group: newGroup });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/join-group", async (req, res) => {
        try {
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
            }

            await dbConn.models.user.update(
                { group_id: group.group_id },
                { where: { user_id: userId } }
            );

            delete group.passcode;
            res.status(200).json({ group });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.get("/group-details/:id", async (req, res) => {
        try {
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
        group.hasPasscode = !!group.passcode;
        delete group.passcode;

        res.status(200).json({ group });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/leave-group", async (req, res) => {
        try {
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

        // Remove user from group first
        user.group_id = null;
        await user.save();

        if (groupMembers.length === 1) {
            // Last member leaving — delete the group
            logger.info("Group " + group.group_id + " deleted");
            await group.destroy();
        } else if (group.owner_id === userId) {
            // Owner leaving — transfer ownership to another member
            const newOwner = groupMembers.find(member => member.user_id !== userId);
            logger.info("User " + userId + " left group. Transferring ownership to " + newOwner.user_id);
            group.owner_id = newOwner.user_id;
            await group.save();
        }
        logger.info("User " + userId + " left group");
        res.status(200).json({ status: "success" });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/remove-member", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const ownerId = req.auth.userId;

            const group = await dbConn.models.group.findOne({
                where: { owner_id: ownerId }
            });
            if (!group) {
                logger.error("Group not found");
                return res.status(404).send("Group not found");
            }
            const { memberId } = req.body;
            const member = await dbConn.models.user.findByPk(memberId);

            if (!member || member.group_id !== group.group_id) {
                return res.status(404).send("Member not found in group");
            }

            member.group_id = null;
            await member.save();
            logger.info("User " + memberId + " removed from group " + group.group_id);
            res.status(200).json({ status: "success" });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    })

    app.get("/get-slogan", async (req, res) => {
        const randomSlogan = slogans[Math.floor(Math.random() * slogans.length)];
        logger.info("Grabbed new Slogan: " + randomSlogan);
        res.status(200).json({ slogan: randomSlogan });
    })

    app.get("/group-loads", async (req, res) => {
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
            loadDays.forEach(day => {
                day.loads.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
            });
            res.send({ days: loadDays });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/edit-group", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const userId = req.auth.userId;
            const { name, slogan, avatar_id, passcode } = req.body;

            const user = await dbConn.models.user.findByPk(userId);

            const group = await dbConn.models.group.findOne({
                where: { group_id: user.group_id }
            });

            if (group.owner_id !== userId) {
                logger.error("Not the owner of the group. Can't edit");
                return res.status(401).send("Unauthorized");
            }

            if (passcode) {
                const hashedPasscode = await hashPassword(passcode);
                group.passcode = hashedPasscode;
            }

            if (name !== undefined) group.name = name;
            if (slogan !== undefined) group.slogan = slogan;
            if (avatar_id !== undefined) group.avatar_id = avatar_id;

            await group.save();

            res.status(200).json({ status: "success" });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.get("/group-invite-code/:groupId", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const userId = req.auth.userId;
            const groupId = req.params.groupId;

            // Verify user is a member of the group
            const user = await dbConn.models.user.findByPk(userId, { raw: true });
            if (!user || user.group_id !== parseInt(groupId)) {
                return res.status(403).send("You are not a member of this group");
            }

            const group = await dbConn.models.group.findByPk(groupId);
            if (!group) {
                return res.status(404).send("Group not found");
            }

            // Generate invite code if one doesn't exist
            if (!group.invite_code) {
                const code = crypto.randomBytes(6).toString("base64url").slice(0, 8);
                group.invite_code = code;
                await group.save();
            }

            res.status(200).json({ inviteCode: group.invite_code });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/join-group-by-invite", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const userId = req.auth.userId;
            const { inviteCode, passcode } = req.body;

            if (!inviteCode) {
                return res.status(400).send("Invite code is required");
            }

            const group = await dbConn.models.group.findOne({
                where: { invite_code: inviteCode },
                attributes: ['group_id', 'name', 'passcode'],
                raw: true
            });

            if (!group) {
                return res.status(404).send("Invalid invite code");
            }

            // Check if user is already in a group
            const user = await dbConn.models.user.findByPk(userId, { raw: true });
            if (user.group_id) {
                return res.status(409).send("You must leave your current group first");
            }

            // If group has passcode and none provided, tell client to prompt
            if (group.passcode && !passcode) {
                return res.status(403).json({
                    requiresPasscode: true,
                    groupId: group.group_id,
                    groupName: group.name
                });
            }

            // Verify passcode if group has one
            if (group.passcode) {
                const passcodeMatch = await checkPassword(group.passcode, passcode);
                if (!passcodeMatch) {
                    return res.status(403).send("Invalid passcode");
                }
            }

            await dbConn.models.user.update(
                { group_id: group.group_id },
                { where: { user_id: userId } }
            );

            delete group.passcode;
            res.status(200).json({ group });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });

    app.post("/remove-passcode", async (req, res) => {
        try {
            if (!req.auth) {
                return res.status(401).send("Unauthorized");
            }
            const userId = req.auth.userId;

            const user = await dbConn.models.user.findByPk(userId);

            const group = await dbConn.models.group.findOne({
                where: { group_id: user.group_id }
            });

            if (group.owner_id !== userId) {
                logger.error("Not the owner of the group. Can't edit");
                return res.status(401).send("Unauthorized");
            }

            group.passcode = null;
            await group.save();

            logger.info("Passcode removed from group " + group.group_id);
            res.status(200).json({ status: "success" });
        } catch (error) {
            logger.error(error);
            res.status(400).json({ status: "error" });
        }
    });
}