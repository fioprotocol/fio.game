const config = {
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_NAME: process.env.DB_NAME || 'wordgame',
    get DATABASE_URL() {
        return `postgresql://${this.DB_USER}:${this.DB_PASSWORD}@${this.DB_HOST}:${this.DB_PORT}/${this.DB_NAME}`;
    },
    PORT: parseInt(process.env.PORT || '3000'),

    FIO_PRIVATE_KEY: process.env.FIO_PRIVATE_KEY || '',
    FIO_PUBLIC_KEY: process.env.FIO_PUBLIC_KEY || '',
    FIO_GUESS_HANDLE: process.env.FIO_GUESS_HANDLE || '',
    FIO_ADMIN_HANDLE: process.env.FIO_ADMIN_HANDLE || '',
    FIO_ADMINS: (process.env.FIO_ADMINS || '').split(','),

    FIO_API_URL: process.env.FIO_API_URL || 'https://test.fio.eosusa.io/v1/',
    FIO_REQ_LIMIT: parseInt(process.env.FIO_REQ_LIMIT || '100'),
    FIO_MAX_FEE: parseInt(process.env.FIO_MAX_FEE || '10000000000000'),
    FIO_TPID: process.env.FIO_TPID || '',


    RECENT_GAMES_LIMIT: process.env.RECENT_GAMES_LIMIT || '10',
    BASE_CHECK_INTERVAL: parseInt(process.env.BASE_CHECK_INTERVAL || '60000'), // 1 minute
    GAME_CHECK_INTERVAL: parseInt(process.env.GAME_CHECK_INTERVAL || '9000'), // 15 minutes 900000
    CLIENT_POLL_INTERVAL: parseInt(process.env.CLIENT_POLL_INTERVAL || '3000'), // 3 seconds
    FIO_CHECK_INTERVAL: parseInt(process.env.FIO_CHECK_INTERVAL || '3000'), // 3 seconds
    MAX_PRIZE: parseInt(process.env.MAX_PRIZE || '1000'),
    LOGGING_LEVEL: (process.env.LOGGING_LEVEL || 'info') as 'info' | 'debug' | 'error',
    LOGGING_METHOD: (process.env.LOGGING_METHOD || 'console') as 'console' | 'file',
};

export default config;