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
      name: {
        type: Sequelize.STRING,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    }
  );
};

export default model;
