import log from "../utils/log.js";
import moment from "moment";
import { hashPassword } from "../utils/passwordFunctions.js";
const logger = log.createLogger("share-the-load-routes-profile");

export default function (app, dbConn) {

  app.get("/profile", async (req, res) => {
    try {
      if (!req.auth) {
        return res.status(401).send("Unauthorized");
      }
      const userId = req.auth.userId;
      const profile = await dbConn.models.user.findByPk(userId, {
        attributes: {
          exclude: ["password"],
        },
        include: [
          {
            model: dbConn.models.preference,
            raw: true,
          },
        ],
      });
      profile.memberSince = moment(profile.created_at).fromNow(true);
      delete profile.dataValues.created_at;

      const totalLoads = await dbConn.models.load.count({
        where: {
          user_id: userId,
        },
      });

      res.status(200).json(
        {
          user_id: profile.user_id,
          username: profile.username,
          email: profile.email,
          avatar: profile.avatar_id,
          load_time: profile.load_time,
          preferences: profile.dataValues.preferences.map(p => {
            return {
              preference_id: p.dataValues.preference_id,
              startTime: moment(p.dataValues.start_time, "HH:mm:ss").format("h:mm a"),
              endTime: moment(p.dataValues.end_time, "HH:mm:ss").format("h:mm a"),
              start_time: p.dataValues.start_time,
              end_time: p.dataValues.end_time,
              day: p.dataValues.day,
              user_id: p.dataValues.user_id
            }
          }),
          memberSince: profile.memberSince,
          loads: totalLoads
        });
    } catch (error) {
      logger.error(error);
      res.status(400).json({ status: "error" });
    }
  });

  app.post("/update-load-time", async (req, res) => {
    if (!req.auth) {
      return res.status(401).send("Unauthorized");
    }
    const userId = req.auth.userId;
    const { loadTime } = req.body;

    const user = await dbConn.models.user.findByPk(userId);

    user.load_time = loadTime;
    await user.save();

    res.status(200).json({ status: "success" });
  })

  app.post("/update-preference", async (req, res) => {
    if (!req.auth) {
      return res.status(401).send("Unauthorized");
    }
    const userId = req.auth.userId;
    const { preference_id, start_time, end_time } = req.body;

    const preference = await dbConn.models.preference.findByPk(preference_id);

    if (!preference) {
      return res.status(404).send("Preference not found");
    }

    if (preference.user_id !== userId) {
      return res.status(403).send("Unauthorized");
    }

    preference.start_time = start_time;
    preference.end_time = end_time;
    await preference.save();

    res.status(200).json({ status: "success" });
  })

  app.post("/edit-profile", async (req, res) => {
    if (!req.auth) {
      return res.status(401).send("Unauthorized");
    }
    const userId = req.auth.userId;
    const { email, avatar, password } = req.body;

    const user = await dbConn.models.user.findByPk(userId);

    if (password) {
      const hashedPassword = await hashPassword(password);
      user.password = hashedPassword;
    }

    user.email = email;
    user.avatar_id = avatar;

    await user.save();

    logger.info(`Updated profile for user ${userId}`);

    res.status(200).json({ status: "success" });
  })

}
