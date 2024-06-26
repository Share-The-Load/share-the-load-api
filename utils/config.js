function get_or_throw(val, err) {
    if (!val) {
        throw err;
    }
    return val;
}

const config = {
    app: {
        port: process.env.APP_PORT || 3001,
        env: process.env.NODE_ENV || 'development'
    },
    client: {
        baseURL: process.env.CLIENT_BASE_URL
    },
    db: {
        database: process.env.MYSQL_DATABASE,
        username: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
    },
    email: {
        smtp: {
            host: get_or_throw(process.env.SMTP_HOST, 'SMTP_HOST not defined'),
            username: get_or_throw(process.env.SMTP_USERNAME, 'SMTP_USERNAME not defined'),
            password: get_or_throw(process.env.SMTP_PASSWORD, 'SMTP_PASSWORD not defined'),
            port: process.env.SMTP_PORT || 587
        },
        from: process.env.SMTP_FROM || process.env.SMTP_USERNAME
    },
    logging: {
        level: process.env.LOG_LEVEL
    },
    jwt: {
        hmac_secret: get_or_throw(process.env.JWT_HMAC_SECRET, 'JWT_HMAC_SECRET not defined')
    },
};

export default config;
