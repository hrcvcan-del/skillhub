'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class BankTransaction extends Model {
    static associate(models) {
      BankTransaction.belongsTo(models.BankAccount, { foreignKey: 'bank_account_id', as: 'bankAccount' });
      BankTransaction.belongsTo(models.BankStatementImport, { foreignKey: 'import_id', as: 'import' });
      BankTransaction.hasMany(models.BankTransactionAssignment, { foreignKey: 'bank_transaction_id', as: 'assignments' });
    }
  }

  BankTransaction.init(
    {
      bank_account_id: { type: DataTypes.INTEGER, allowNull: false },
      import_id: DataTypes.INTEGER,
      transaction_date: { type: DataTypes.DATEONLY, allowNull: false },
      value_date: DataTypes.DATEONLY,
      narration: DataTypes.TEXT,
      party_name: DataTypes.STRING,
      reference_number: DataTypes.STRING,
      utr_number: DataTypes.STRING,
      cheque_number: DataTypes.STRING,
      payment_mode: DataTypes.ENUM('neft', 'rtgs', 'imps', 'upi', 'cheque', 'cash', 'bank_charges', 'auto_debit', 'other'),
      debit_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      credit_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      closing_balance: DataTypes.DECIMAL(14, 2),
      status: {
        type: DataTypes.ENUM(
          'unassigned',
          'suggested',
          'partially_assigned',
          'assigned',
          'verified',
          'ignored',
          'duplicate'
        ),
        allowNull: false,
        defaultValue: 'unassigned',
      },
    },
    {
      sequelize,
      modelName: 'BankTransaction',
      tableName: 'bank_transactions',
      underscored: true,
    }
  );

  return BankTransaction;
};
