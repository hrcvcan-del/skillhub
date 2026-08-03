'use strict';
const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.FeePayment, { foreignKey: 'recorded_by', as: 'feePayments' });
      User.hasMany(models.TrainerSalaryPayment, { foreignKey: 'recorded_by', as: 'salaryPayments' });
      User.hasMany(models.RentPayment, { foreignKey: 'recorded_by', as: 'rentPayments' });
      User.hasMany(models.Expense, { foreignKey: 'recorded_by', as: 'expenses' });
      User.hasMany(models.AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
    }

    async verifyPassword(plain) {
      return bcrypt.compare(plain, this.password_hash);
    }
  }

  User.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password_hash: { type: DataTypes.STRING, allowNull: false },
      role: {
        type: DataTypes.ENUM('admin', 'manager', 'staff', 'trainer'),
        allowNull: false,
        defaultValue: 'staff',
      },
      phone: DataTypes.STRING,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      last_login_at: DataTypes.DATE,
      password_reset_token: DataTypes.STRING,
      password_reset_expires_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password_hash) {
            user.password_hash = await bcrypt.hash(user.password_hash, 10);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password_hash')) {
            user.password_hash = await bcrypt.hash(user.password_hash, 10);
          }
        },
      },
      defaultScope: {
        attributes: { exclude: [] },
      },
    }
  );

  return User;
};
