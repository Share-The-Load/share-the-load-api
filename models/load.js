import { Sequelize } from "sequelize";

const model = function (dbConn, user, group) {
  const load = dbConn.define(
    "load",
    {
      load_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      start_time: {
        type: Sequelize.DATE,
      },
      end_time: {
        type: Sequelize.DATE,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    }
  );

  user.hasMany(load, { foreignKey: "user_id" });
  load.belongsTo(user, { foreignKey: "user_id" });

  group.hasMany(load, { foreignKey: "group_id" });
  load.belongsTo(group, { foreignKey: "group_id" });

  return load;
};

export default model;
