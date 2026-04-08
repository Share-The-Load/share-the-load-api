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
import LoadService from "./services/load.js";
import EmailService from "./services/email.js";

//Routes
import ProfileRoutes from './routes/profile.js';
import HealthRoutes from './routes/health.js';
import AccountRoutes from './routes/account.js';
import GroupRoutes from './routes/group.js';
import LoadRoutes from './routes/load.js';
import InsightsRoutes from './routes/insights.js';
import InviteRoutes from './routes/invite.js';

const app = express();
const port = config.app.port;

const logger = log.createLogger("share-the-load-server");

function loggingMiddleware(req, res, next) {
  var logentry = "IP: " + req.ip;

  if (req.body && Object.keys(req.body).length > 0) {
    logentry += " Body: (" + JSON.stringify(req.body) + ")";
  }

  if (req.params && Object.keys(req.params).length > 0) {
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
    return DbConn.sync();
  })
  .then(function () {
    logger.debug("Connection has been established successfully.");

    const nodemailerConfig = {
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: false, //This means it will use STARTTLS of available
      auth: {
        user: config.email.smtp.username,
        pass: config.email.smtp.password
      }
    };

    app.ctx = {};
    app.ctx.dbConn = DbConn;
    app.ctx.config = config;

    app.ctx.emailService = new EmailService(config.email.from, nodemailerConfig, 'email-templates');
    app.ctx.userService = new UserService(DbConn, config.jwt.hmac_secret, app.ctx.emailService);
    app.ctx.loadService = new LoadService(DbConn);

    app.use(cors());
    app.use(bodyParser.json());
    app.use(loggingMiddleware);

    // Static files for OG image etc.
    app.use('/invite', express.static('public/invite'));

    // Invite landing page (public, no auth required — must be before auth middleware)
    InviteRoutes(app, DbConn);

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
            logger.error("Failed to decode auth token: " + err.message);
            return res.status(403).send("Unauthorized");
          });
      } else {
        logger.error("Invalid authentication header format");
        return res.status(403).send("Unauthorized");
      }
    });

    ProfileRoutes(app, DbConn);
    AccountRoutes(app);
    HealthRoutes(app);
    GroupRoutes(app, DbConn);
    LoadRoutes(app, DbConn);
    InsightsRoutes(app, DbConn);

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
