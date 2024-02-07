import log from "../utils/log.js";

const logger = log.createLogger("share-the-load-routes-home");

export default function (app, db) {
  app.get("/home", async (req, res) => {
    try {
      //get userId from req.auth
      const userId = 2;
      const profile = await db.models.user.findOne({
        where: {
          user_id: userId,
        },
      });
      const groupId = profile.group_id;
      const loads = await db.models.load.findAll({
        where: {
          group_id: groupId,
        },
        include: [
            { model: db.models.user }
        ]
      });
      console.log(loads);
      res.send({
        loads,
      });
    } catch (error) {
      res.status(400).json({ status: "error" });
    }
  });

  app.post("/schedule", async (req, res) => {
    try {
      const startTime = req.body.startTime;
      const numberOfLoads = req.body.numberOfLoads;

      //get userId from req.auth
      const userId = 2;
      const profile = await db.models.user.findOne({
        where: {
          user_id: userId,
        },
      });

      const loadTime = profile.load_time;

      
      

    } catch (error) {
      res.status(400).json({ status: "error" });
    }
  });
}
