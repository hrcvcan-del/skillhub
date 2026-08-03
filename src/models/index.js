'use strict';
const sequelize = require('../config/db');
const { Sequelize } = require('sequelize');

const db = { sequelize, Sequelize };

db.User = require('./user')(sequelize);
db.TrainingCenter = require('./trainingCenter')(sequelize);
db.Course = require('./course')(sequelize);
db.Trainer = require('./trainer')(sequelize);
db.Batch = require('./batch')(sequelize);
db.Student = require('./student')(sequelize);
db.Enrollment = require('./enrollment')(sequelize);
db.FeePayment = require('./feePayment')(sequelize);
db.TrainerSalaryPayment = require('./trainerSalaryPayment')(sequelize);
db.RentPayment = require('./rentPayment')(sequelize);
db.Expense = require('./expense')(sequelize);
db.EquipmentInventory = require('./equipmentInventory')(sequelize);
db.AuditLog = require('./auditLog')(sequelize);

Object.values(db).forEach((model) => {
  if (model.associate) {
    model.associate(db);
  }
});

module.exports = db;
