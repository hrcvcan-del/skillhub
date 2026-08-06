'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class BankAccount extends Model {
    static associate(models) {
      BankAccount.hasMany(models.BankStatementImport, { foreignKey: 'bank_account_id', as: 'imports' });
      BankAccount.hasMany(models.BankTransaction, { foreignKey: 'bank_account_id', as: 'transactions' });
    }
  }

  BankAccount.init(
    {
      bank_name: { type: DataTypes.STRING, allowNull: false },
      account_name: { type: DataTypes.STRING, allowNull: false },
      account_number: { type: DataTypes.STRING, allowNull: false },
      ifsc_code: DataTypes.STRING,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'BankAccount',
      tableName: 'bank_accounts',
      underscored: true,
    }
  );

  return BankAccount;
};
