'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class FeePayment extends Model {
    static associate(models) {
      FeePayment.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id', as: 'enrollment' });
      FeePayment.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
    }
  }

  FeePayment.init(
    {
      enrollment_id: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      payment_date: { type: DataTypes.DATEONLY, allowNull: false },
      payment_mode: {
        type: DataTypes.ENUM('cash', 'upi', 'card', 'bank_transfer'),
        allowNull: false,
        defaultValue: 'cash',
      },
      receipt_number: DataTypes.STRING,
      recorded_by: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'FeePayment',
      tableName: 'fee_payments',
      underscored: true,
    }
  );

  return FeePayment;
};
