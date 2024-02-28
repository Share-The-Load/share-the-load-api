import { Op } from "sequelize";
import slogans from "../constants/slogans.js";
import { hashPassword, checkPassword } from "../utils/passwordFunctions.js";
import log from "../utils/log.js";
export default function (app, dbConn) {
    const logger = log.createLogger('sharetheload-routes-group');

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
            attributes: ['group_id', 'name', 'slogan', 'passcode', 'owner_id'],
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

        const group = await dbConn.models.group.create({
            name,
            passcode: hashedPasscode,
            slogan: randomSlogan,
            owner_id: ownerId
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
            const passcodeMatch = await checkPassword(passcode, group.passcode);
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

}