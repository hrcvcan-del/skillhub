'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainingPartnerBill extends Model {
    static associate(models) {
      TrainingPartnerBill.belongsTo(models.TrainingPartner, { foreignKey: 'training_partner_id', as: 'trainingPartner' });
      TrainingPartnerBill.belongsTo(models.User, { foreignKey: 'generated_by', as: 'generatedByUser' });
      TrainingPartnerBill.belongsTo(models.User, { foreignKey: 'reviewed_by', as: 'reviewedByUser' });
      TrainingPartnerBill.hasMany(models.TrainingPartnerCandidate, { foreignKey: 'bill_id', as: 'candidates' });
      TrainingPartnerBill.hasMany(models.BankTransactionAssignment, { foreignKey: 'training_partner_bill_id', as: 'assignments' });
    }
  }

  TrainingPartnerBill.init(
    {
      training_partner_id: { type: DataTypes.INTEGER, allowNull: false },
      period_from: { type: DataTypes.DATEONLY, allowNull: false },
      period_to: { type: DataTypes.DATEONLY, allowNull: false },
      candidate_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      gross_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      deduction_percent: DataTypes.DECIMAL(5, 2),
      deduction_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      net_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      amount_paid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('pending_review', 'approved', 'paid', 'rejected'),
        allowNull: false,
        defaultValue: 'pending_review',
      },
      generated_by: DataTypes.INTEGER,
      reviewed_by: DataTypes.INTEGER,
      reviewed_at: DataTypes.DATE,
      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'TrainingPartnerBill',
      tableName: 'training_partner_bills',
      underscored: true,
    }
  );

  return TrainingPartnerBill;
};
