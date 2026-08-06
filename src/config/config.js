require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');

const useSsl = process.env.DATABASE_SSL === 'true';
const dialectOptions = useSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  dialectOptions,
  logging: false,
};

module.exports = {
  development: { ...base },
  test: { ...base, logging: false },
  production: { ...base },
};
