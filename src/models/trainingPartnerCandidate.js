'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainingPartnerCandidate extends Model {
    static associate(models) {
      TrainingPartnerCandidate.belongsTo(models.TrainingPartner, { foreignKey: 'training_partner_id', as: 'trainingPartner' });
      TrainingPartnerCandidate.belongsTo(models.TrainingPartnerBill, { foreignKey: 'bill_id', as: 'bill' });
    }
  }

  TrainingPartnerCandidate.init(
    {
      training_partner_id: { type: DataTypes.INTEGER, allowNull: false },
      candidate_name: { type: DataTypes.STRING, allowNull: false },
      training_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      trained_date: { type: DataTypes.DATEONLY, allowNull: false },
      notes: DataTypes.TEXT,
      bill_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'TrainingPartnerCandidate',
      tableName: 'training_partner_candidates',
      underscored: true,
    }
  );

  return TrainingPartnerCandidate;
};
