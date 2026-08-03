'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Enrollment extends Model {
    static associate(models) {
      Enrollment.belongsTo(models.Student, { foreignKey: 'student_id', as: 'student' });
      Enrollment.belongsTo(models.Batch, { foreignKey: 'batch_id', as: 'batch' });
      Enrollment.hasMany(models.FeePayment, { foreignKey: 'enrollment_id', as: 'feePayments' });
    }
  }

  Enrollment.init(
    {
      student_id: { type: DataTypes.INTEGER, allowNull: false },
      batch_id: { type: DataTypes.INTEGER, allowNull: false },
      enrollment_date: { type: DataTypes.DATEONLY, allowNull: false },
      total_fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      fee_paid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      fee_due: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('active', 'completed', 'dropped'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      sequelize,
      modelName: 'Enrollment',
      tableName: 'enrollments',
      underscored: true,
    }
  );

  return Enrollment;
};
