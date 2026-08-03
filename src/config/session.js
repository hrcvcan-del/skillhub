const session = require('express-session');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const env = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { require: true, rejectUnauthorized: false } : false,
});

const store = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
});

const sessionMiddleware = session({
  store,
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2,
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
  },
});

sessionMiddleware.pool = pool;

module.exports = sessionMiddleware;
