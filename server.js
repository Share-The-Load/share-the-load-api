import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

//DB stuff
import DbConn from "./DB-config.js";

// Utils
import log from "./utils/log.js";
import config from "./utils/config.js";

//Services
import UserService from "./services/user.js";

//Routes
import ProfileRoutes from './routes/profile.js';
import HomeRoutes from './routes/home.js';
import HealthRoutes from './routes/health.js';
import AccountRoutes from './routes/account.js';
import GroupRoutes from './routes/group.js';

const app = express();
const port = 3006;

const logger = log.createLogger("share-the-load-server");

function loggingMiddleware(req, res, next) {
  var logentry = "IP: " + req.ip;

  if (req.body) {
    logentry += " Body: (" + logentry + ")";
  }

  if (req.params) {
    logentry += " Params: (" + JSON.stringify(req.params) + ")";
  }

  logger.info(logentry);
  next();
}

// ----------------------------------------------------
// Connect to the database

logger.info("GOING TO CONNECT DB");

DbConn.authenticate()
  .then(function () {
    //TODO: Remove this since it will conflict with migrations
    return DbConn.sync();
  })
  .then(function () {
    logger.debug("Connection has been established successfully.");

    app.ctx = {};
    app.ctx.dbConn = DbConn;
    app.ctx.config = config;

    app.ctx.userService = new UserService(DbConn, config.jwt.hmac_secret);

    app.use(cors());
    app.use(loggingMiddleware);

    app.use(function (req, res, next) {
      var authHeader = req.get('Authorization');
      if (!authHeader) {
        return next();
      }
      var parts = authHeader.split(' ');
      if (parts[0] == 'Bearer') {
        app.ctx.userService.validateAndDecodeToken(parts[1])
          .then(function (token) {
            req.auth = token;
            next();
          })
          .catch(function (err) {
            logger.error("Invalid authentication header \"" + authHeader + "\"");
            logger.error("Err decoding token: " + err);
            return res.status(403).send("Unauthorized");
          });
      } else {
        logger.error("Invalid authentication header \"" + authHeader + "\"");
        return res.status(403).send("Unauthorized");
      }
    });

    // Body parser for custom routes
    app.use(bodyParser.json());


    ProfileRoutes(app, DbConn);
    HomeRoutes(app, DbConn);
    AccountRoutes(app);
    HealthRoutes(app);
    GroupRoutes(app, DbConn);

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch(function (err) {
    logger.error("Unable to initialize application: ", err);
    if (err.stack) {
      logger.error(err.stack);
    }
    process.exit(1);
  });
