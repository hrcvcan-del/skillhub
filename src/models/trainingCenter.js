'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainingCenter extends Model {
    static associate(models) {
      TrainingCenter.hasMany(models.Batch, { foreignKey: 'training_center_id', as: 'batches' });
      TrainingCenter.hasMany(models.RentPayment, { foreignKey: 'training_center_id', as: 'rentPayments' });
      TrainingCenter.hasMany(models.Expense, { foreignKey: 'training_center_id', as: 'expenses' });
      TrainingCenter.hasMany(models.EquipmentInventory, { foreignKey: 'training_center_id', as: 'equipment' });
      TrainingCenter.hasMany(models.TrainerSalaryPayment, { foreignKey: 'training_center_id', as: 'salaryPayments' });
      TrainingCenter.belongsTo(models.SchemePhase, { foreignKey: 'scheme_phase_id', as: 'schemePhase' });
      TrainingCenter.belongsTo(models.User, { foreignKey: 'coordinator_id', as: 'coordinator' });
    }
  }

  TrainingCenter.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      address: DataTypes.STRING,
      city: DataTypes.STRING,
      phone: DataTypes.STRING,
      email: DataTypes.STRING,
      capacity: DataTypes.INTEGER,
      monthly_rent_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      landlord_name: DataTypes.STRING,
      landlord_contact: DataTypes.STRING,
      lease_start_date: DataTypes.DATEONLY,
      lease_end_date: DataTypes.DATEONLY,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      scheme_phase_id: DataTypes.INTEGER,
      coordinator_id: DataTypes.INTEGER,
      owner_bank_account_number: DataTypes.STRING,
      owner_upi_id: DataTypes.STRING,
      planned_closure_date: DataTypes.DATEONLY,
    },
    {
      sequelize,
      modelName: 'TrainingCenter',
      tableName: 'training_centers',
      underscored: true,
    }
  );

  return TrainingCenter;
};
