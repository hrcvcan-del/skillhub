'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class RentPayment extends Model {
    static associate(models) {
      RentPayment.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      RentPayment.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
    }
  }

  RentPayment.init(
    {
      training_center_id: { type: DataTypes.INTEGER, allowNull: false },
      for_month: { type: DataTypes.INTEGER, allowNull: false },
      for_year: { type: DataTypes.INTEGER, allowNull: false },
      amount_due: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      amount_paid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      due_date: { type: DataTypes.DATEONLY, allowNull: false },
      paid_date: DataTypes.DATEONLY,
      status: {
        type: DataTypes.ENUM('pending', 'paid', 'overdue'),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_mode: DataTypes.ENUM('cash', 'upi', 'card', 'bank_transfer'),
      recorded_by: DataTypes.INTEGER,
      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'RentPayment',
      tableName: 'rent_payments',
      underscored: true,
    }
  );

  return RentPayment;
};
