import log from "../utils/log.js";

const logger = log.createLogger("share-the-load-routes-profile");

function saveObjects(objects, dbModel, mapper) {
  if (objects) {
    const promises = objects.map((obj) => {
      const dataDefinition = mapper(obj);
      return dbModel.create(dataDefinition);
    });
    return promises;
  } else {
    return Promise.resolve([]);
  }
}

export default function (app, db) {
  app.get("/profile", async (req, res) => {
    try {
      //get userId from req.auth
      const userId = 2;
      const profile = await db.models.user.findOne({
        where: {
          user_id: userId,
        },
      });
      const preferences = await db.models.preference.findAll({
        where: {
          user_id: userId,
        },
      });
      const group = await db.models.group.findOne({
        where: {
          group_id: profile.group_id,
        },
      });
      const groupMembers = await db.models.user.findAll({
        where: {
          group_id: profile.group_id,
        },
      });
      console.log(group);
      res.send({
        profile,
        preferences,
        group: { groupInfo: group, groupMembers },
      });
    } catch (error) {
      res.status(400).json({ status: "error" });
    }
  });

  
}
