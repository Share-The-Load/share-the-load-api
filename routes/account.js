import log from '../utils/log.js';

export default function (app) {
    const logger = log.createLogger('sharetheload-routes-account');

    const userService = app.ctx.userService;

    app.post('/account/isUsernameAvailable', async (req, res) => {
        const { username } = req.body;
        const isAvailable = await userService.isUsernameAvailable(username);
        res.status(200).json({ isAvailable });
    })


    app.post('/account/login', async (req, res) => {
        const { username, password } = req.body;

        logger.debug("Attempting login for username " + username);


        userService.login(username, password)
            .then(authResult => {
                sendAuthData(res, authResult);
            })
            .catch(err => {
                logger.error("Error authenticating user (" + username + "): " + err);
                if (err.stack) {
                    logger.error(err.stack);
                }
                res.status(403).send("Wrong username or password");
            });
    });

    app.post('/account/register', async (req, res) => {
        const { username, password, email } = req.body;

        logger.debug("Attempting register for username " + username);

        userService.register(username, email, password)
            .then(authResult => {
                sendAuthData(res, authResult);
            })
            .catch(err => {
                logger.error("Error registering user (" + username + "): " + err);
                if (err.stack) {
                    logger.error(err.stack);
                }
                res.status(403).send("Error registering user");
            });
    });


    async function sendAuthData(res, authResult) {
        console.log(`❗️❗️❗️ authRe`, authResult)
        res.status(200)
            .json({
                user: {
                    userId: authResult.user.user_id,
                    groupId: authResult.user.group_id,
                    token: authResult.token,
                    refreshToken: authResult.refreshToken,
                },
            });
    }


}