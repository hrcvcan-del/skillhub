const { Sequelize } = require('sequelize');
const env = require('./env');

const dialectOptions = env.databaseSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  dialectOptions,
  logging: false,
});

module.exports = sequelize;
