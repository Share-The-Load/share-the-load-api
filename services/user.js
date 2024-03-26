import jwt from 'jsonwebtoken';
import log from '../utils/log.js';
import { Sequelize } from 'sequelize';
import { checkPassword, hashPassword } from '../utils/passwordFunctions.js';

const ACCESS_TOKEN_EXP_TIME_SECONDS = 86400; //Seconds = 24 Hours
const REFRESH_TOKEN_EXP_TIME_DAYS = '180d'; //Days

const logger = log.createLogger('sharetheload-services-user');

const Op = Sequelize.Op;

class UserService {
    constructor(dbConn, hmacSecret) {
        this.dbConn = dbConn;
        this.hmacSecret = hmacSecret;
    }

    async login(username, password) {
        const user = await this.dbConn.models.user.findOne({
            where: {
                [Op.or]: [{ username: username.toLowerCase().trim() }, { email: username.toLowerCase().trim() }]
            },
            raw: true

        });

        if (!user) {
            throw new Error("User not found");
        }

        const passwordMatch = await checkPassword(user.password, password);
        if (!passwordMatch) {
            throw new Error("Invalid password");
        }

        const authData = await this.generateAuthData(user);

        return authData;
    }

    async register(username, email, password) {
        const hashedPassword = await hashPassword(password);
        const randomAvatarId = Math.floor(Math.random() * 10) + 1;
        const user = await this.dbConn.models.user.create({
            username: username.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            avatar_id: randomAvatarId
        });

        const authData = await this.generateAuthData(user);
        return authData;
    }



    async isUsernameAvailable(username) {
        logger.debug("Validating username (" + username + ")");
        if (username) {
            if (/^[A-Za-z0-9]{5,25}$/.test(username)) {
                const matching_user = await this.dbConn.models.user.findOne({
                    where: {
                        username: username
                    }
                });

                logger.debug("Matching user is: " + matching_user);
                if (!matching_user) {
                    return true;
                }
            } else {
                logger.debug("Username format is invalid");
            }
        }
        return false;

    }

    generateAuthData(user) {
        var authTokenPromise = this.createAuthToken(user);
        var refreshTokenPromise = this.createRefreshToken(user);
        return Promise.all([authTokenPromise, refreshTokenPromise])
            .then(tokens => {
                return { user: user, token: tokens[0], refreshToken: tokens[1] };
            });
    }

    createAuthToken(user) {
        return this.createSignedToken(
            { "userId": user.user_id },
            ACCESS_TOKEN_EXP_TIME_SECONDS
        );
    }

    createRefreshToken(user) {
        return this.createSignedToken(
            { "userId": user.user_id },
            REFRESH_TOKEN_EXP_TIME_DAYS
        );
    }

    createSignedToken(data, expSeconds) {
        return jwt.sign(
            data,
            this.hmacSecret,
            {
                algorithm: 'HS256',
                expiresIn: expSeconds
            },
        );
    }

    validateAndDecodeToken(token) {
        var _self = this;
        return new Promise(function (resolve, reject) {
            jwt.verify(token, _self.hmacSecret, function (err, decodedToken) {
                if (err) {
                    reject(err);
                } else {
                    resolve(decodedToken);
                }
            });
        });
    }

    validateAndGenerateRefreshedTokens(rawRefreshToken) {
        var _self = this;
        return this.validateAndDecodeToken(rawRefreshToken)
            .then(function (refreshTokenData) {
                return _self.dbConn.models.user.findByPk(refreshTokenData.userId);
            }).then(function (user) {
                return _self.generateAuthData(user);
            });
    }
}

export default UserService;