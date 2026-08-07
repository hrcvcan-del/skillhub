'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainerAdvance extends Model {
    static associate(models) {
      TrainerAdvance.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      TrainerAdvance.belongsTo(models.TrainerSalaryPayment, { foreignKey: 'deducted_in_salary_payment_id', as: 'deductedInPayment' });
      TrainerAdvance.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
    }
  }

  TrainerAdvance.init(
    {
      trainer_id: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      advance_date: { type: DataTypes.DATEONLY, allowNull: false },
      notes: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM('pending', 'deducted'),
        allowNull: false,
        defaultValue: 'pending',
      },
      deducted_in_salary_payment_id: DataTypes.INTEGER,
      recorded_by: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'TrainerAdvance',
      tableName: 'trainer_advances',
      underscored: true,
    }
  );

  return TrainerAdvance;
};
