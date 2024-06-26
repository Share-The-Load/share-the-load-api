import { Sequelize } from "sequelize";

const model = function (dbConn, group) {
  const user = dbConn.define(
    "user",
    {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: Sequelize.STRING,
      },
      email: {
        type: Sequelize.STRING,
      },
      created_at: {
        type: Sequelize.DATE,
      },
      updated_at: {
        type: Sequelize.DATE,
      },
      password: {
        type: Sequelize.STRING,
      },
      avatar_id: {
        type: Sequelize.INTEGER,
      },
      load_time: {
        type: Sequelize.DOUBLE,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    }
  );

  group.hasMany(user, { foreignKey: "group_id" });
  user.belongsTo(group, { foreignKey: "group_id" });

  return user;
};

export default model;
