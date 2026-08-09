'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Trainer extends Model {
    static associate(models) {
      Trainer.hasMany(models.Batch, { foreignKey: 'trainer_id', as: 'batches' });
      Trainer.hasMany(models.TrainerSalaryPayment, { foreignKey: 'trainer_id', as: 'salaryPayments' });
      Trainer.hasMany(models.TrainerAdvance, { foreignKey: 'trainer_id', as: 'advances' });
      Trainer.hasMany(models.TrainerAttendance, { foreignKey: 'trainer_id', as: 'attendances' });
    }
  }

  Trainer.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, unique: true, validate: { isEmail: true } },
      phone: DataTypes.STRING,
      specialization: DataTypes.STRING,
      qualification: DataTypes.STRING,
      joining_date: DataTypes.DATEONLY,
      exit_date: DataTypes.DATEONLY,
      salary_type: {
        type: DataTypes.ENUM('monthly', 'per_batch', 'hourly'),
        allowNull: false,
        defaultValue: 'monthly',
      },
      salary_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      bank_account_number: DataTypes.STRING,
      ifsc_code: DataTypes.STRING,
      bank_name: DataTypes.STRING,
      bank_branch: DataTypes.STRING,
      aadhar_card_url: DataTypes.STRING,
      education_certificate_url: DataTypes.STRING,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Trainer',
      tableName: 'trainers',
      underscored: true,
    }
  );

  return Trainer;
};
