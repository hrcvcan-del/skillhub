'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class BankStatementImport extends Model {
    static associate(models) {
      BankStatementImport.belongsTo(models.BankAccount, { foreignKey: 'bank_account_id', as: 'bankAccount' });
      BankStatementImport.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploadedByUser' });
      BankStatementImport.hasMany(models.BankTransaction, { foreignKey: 'import_id', as: 'transactions' });
    }
  }

  BankStatementImport.init(
    {
      bank_account_id: { type: DataTypes.INTEGER, allowNull: false },
      statement_from_date: DataTypes.DATEONLY,
      statement_to_date: DataTypes.DATEONLY,
      file_name: DataTypes.STRING,
      file_type: { type: DataTypes.ENUM('csv', 'xls', 'xlsx', 'pdf'), allowNull: false },
      uploaded_by: DataTypes.INTEGER,
      remarks: DataTypes.TEXT,
      transaction_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duplicate_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'BankStatementImport',
      tableName: 'bank_statement_imports',
      underscored: true,
    }
  );

  return BankStatementImport;
};
