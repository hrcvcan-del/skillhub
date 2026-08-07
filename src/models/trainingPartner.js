'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainingPartner extends Model {
    static associate(models) {
      TrainingPartner.hasMany(models.User, { foreignKey: 'training_partner_id', as: 'users' });
      TrainingPartner.hasMany(models.TrainingPartnerCandidate, { foreignKey: 'training_partner_id', as: 'candidates' });
      TrainingPartner.hasMany(models.TrainingPartnerBill, { foreignKey: 'training_partner_id', as: 'bills' });
    }
  }

  TrainingPartner.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      account_number: DataTypes.STRING,
      bank_name: DataTypes.STRING,
      ifsc_code: DataTypes.STRING,
      address: DataTypes.TEXT,
      contact_person: DataTypes.STRING,
      contact_phone: DataTypes.STRING,
      contact_email: DataTypes.STRING,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'TrainingPartner',
      tableName: 'training_partners',
      underscored: true,
    }
  );

  return TrainingPartner;
};
