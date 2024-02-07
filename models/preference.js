import { Sequelize } from "sequelize";

const model = function (dbConn, user) {
  const preference = dbConn.define(
    "preference",
    {
      preference_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      day: {
        type: Sequelize.STRING,
      },
      start_time: {
        type: Sequelize.TIME,
      },
      end_time: {
        type: Sequelize.TIME,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    }
  );

  user.hasMany(preference, { foreignKey: "user_id" });
  preference.belongsTo(user, { foreignKey: "user_id" });

  return preference;
};

export default model;
