'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainerSalaryPayment extends Model {
    static associate(models) {
      TrainerSalaryPayment.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      TrainerSalaryPayment.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      TrainerSalaryPayment.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
      TrainerSalaryPayment.hasMany(models.TrainerAdvance, { foreignKey: 'deducted_in_salary_payment_id', as: 'deductedAdvances' });
    }
  }

  TrainerSalaryPayment.init(
    {
      trainer_id: { type: DataTypes.INTEGER, allowNull: false },
      training_center_id: DataTypes.INTEGER,
      for_month: { type: DataTypes.INTEGER, allowNull: false },
      for_year: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      bonus_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      deduction_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      payment_date: DataTypes.DATEONLY,
      payment_mode: DataTypes.ENUM('cash', 'upi', 'card', 'bank_transfer'),
      status: {
        type: DataTypes.ENUM('pending', 'paid', 'partially_paid'),
        allowNull: false,
        defaultValue: 'pending',
      },
      recorded_by: DataTypes.INTEGER,
      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'TrainerSalaryPayment',
      tableName: 'trainer_salary_payments',
      underscored: true,
    }
  );

  return TrainerSalaryPayment;
};
