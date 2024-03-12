import { Sequelize } from "sequelize";

const model = function (dbConn) {
  return dbConn.define(
    "group",
    {
      group_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      owner_id: {
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
      },
      passcode: {
        type: Sequelize.STRING,
      },
      slogan: {
        type: Sequelize.STRING,
      },
      avatar_id: {
        type: Sequelize.INTEGER,
      },
      created_at: {
        type: Sequelize.DATE,
      },
      updated_at: {
        type: Sequelize.DATE,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    }
  );
};

export default model;
