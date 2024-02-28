import Sequelize from 'sequelize';

import log from "./utils/log.js";
import config from "./utils/config.js";

import UserDefinition from "./models/user.js";
import LoadDefinition from "./models/load.js";
import GroupDefinition from "./models/group.js";
import PreferenceDefinition from "./models/preference.js";

const logger = log.createLogger("share-the-load-db");

// -----------------------------------------------------
// database connection configuration
// NOTICE: This stuff should be server.js
// but because we need the connection here and to
// pass the connection would complicate things a bit
// we are just leaving them here for now

const db_host = config.db.host;
const db_user = config.db.username;
const db_password = config.db.password;
const db_database = config.db.database;

if (!db_host) {
  logger.error("Missing database host, make sure MYSQL_HOST is set\n");
}

if (!db_user) {
  logger.error("Missing database user, make sure MYSQL_USER is set\n");
}

if (!db_password) {
  logger.error("Missing database password, make sure MYSQL_PASSWORD is set\n");
}

if (!db_database) {
  logger.error("Missing database name, make sure MYSQL_DATABASE is set\n");
}

if (!db_host || !db_user || !db_password || !db_database) {
  logger.error("Incomplete database configuration\n");
  process.exit(1);
}

logger.debug(
  "Creating database connection to (" +
  db_database +
  ") at (" +
  db_host +
  ") as (" +
  db_user +
  ")"
);
const Conn = new Sequelize(db_database, db_user, db_password, {
  host: db_host,
  dialect: "mysql",
  define: {
    timestamps: false,
  },
});

//Schema definition

const Group = GroupDefinition(Conn);
const User = UserDefinition(Conn, Group);
const Load = LoadDefinition(Conn, User, Group);
const Preference = PreferenceDefinition(Conn, User);


export default Conn;
