import log from '../utils/log.js';

import nodemailer from 'nodemailer';
import Email from 'email-templates';

const logger = log.createLogger('share-the-load-email');

class EmailService {

    constructor(from, nodemailerConfig, templatesDir) {
        this._from = from;
        this._template = null;
        this._templatesDir = templatesDir;
        this._transport = nodemailer.createTransport(nodemailerConfig);
        this._template = new Email({
            views: { root: templatesDir }
        });
    }


    send(to, subject, text, html) {
        return new Promise((resolve, reject) => {
            var params = {
                from: this._from,
                to: to,
                subject: subject,
                text: text
            };

            if (html) {
                params.html = html;
            }

            logger.debug("Sending email (" + to + ") subject (" + subject + ")");

            this._transport.sendMail(params, function (err, res) {
                if (err) {
                    logger.error("Error sending email: " + err);
                    reject(err);
                } else {
                    logger.debug("Email sent successfully!");
                    resolve(res);
                }
            });
        });
    }

    sendMail(to, subject, tplName, locals) {
        logger.debug("Sending mail to (" + to + ") subject (" + subject + ") template (" + tplName + ")");
        return Promise.all([
            this._template.render(tplName + "/html", locals),
            this._template.render(tplName + "/text", locals)
        ]).then(([html, text]) => {
            logger.debug("Template rendered");
            return this.send(to, subject, text, html);
        });
    }
}

export default EmailService;
// vim: tabstop=2 shiftwidth=2 expandtab
