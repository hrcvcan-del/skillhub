'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class BankTransactionAssignment extends Model {
    static associate(models) {
      BankTransactionAssignment.belongsTo(models.BankTransaction, { foreignKey: 'bank_transaction_id', as: 'bankTransaction' });
      BankTransactionAssignment.belongsTo(models.Expense, { foreignKey: 'expense_id', as: 'expense' });
      BankTransactionAssignment.belongsTo(models.TrainerSalaryPayment, {
        foreignKey: 'trainer_salary_payment_id',
        as: 'trainerSalaryPayment',
      });
      BankTransactionAssignment.belongsTo(models.RentPayment, { foreignKey: 'rent_payment_id', as: 'rentPayment' });
      BankTransactionAssignment.belongsTo(models.User, { foreignKey: 'assigned_by', as: 'assignedByUser' });
      BankTransactionAssignment.belongsTo(models.User, { foreignKey: 'verified_by', as: 'verifiedByUser' });
    }
  }

  BankTransactionAssignment.init(
    {
      bank_transaction_id: { type: DataTypes.INTEGER, allowNull: false },
      category: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      expense_id: DataTypes.INTEGER,
      trainer_salary_payment_id: DataTypes.INTEGER,
      rent_payment_id: DataTypes.INTEGER,
      notes: DataTypes.TEXT,
      assigned_by: DataTypes.INTEGER,
      assigned_at: DataTypes.DATE,
      verified_by: DataTypes.INTEGER,
      verified_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'BankTransactionAssignment',
      tableName: 'bank_transaction_assignments',
      underscored: true,
    }
  );

  return BankTransactionAssignment;
};
