'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class MobilizationForm extends Model {
    static associate(models) {
      MobilizationForm.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      MobilizationForm.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      MobilizationForm.belongsTo(models.User, { foreignKey: 'center_coordinator_id', as: 'centerCoordinator' });
      MobilizationForm.belongsTo(models.User, { foreignKey: 'reviewed_by', as: 'reviewedByUser' });
      MobilizationForm.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
    }
  }

  MobilizationForm.init(
    {
      training_center_id: { type: DataTypes.INTEGER, allowNull: false },
      trainer_id: { type: DataTypes.INTEGER, allowNull: false },
      center_coordinator_id: { type: DataTypes.INTEGER, allowNull: false },
      form_date: { type: DataTypes.DATEONLY, allowNull: false },
      forms_submitted_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      forms_accepted_count: DataTypes.INTEGER,
      forms_verified_count: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM('pending', 'reviewed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewed_by: DataTypes.INTEGER,
      reviewed_at: DataTypes.DATE,
      recorded_by: DataTypes.INTEGER,
      remarks: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'MobilizationForm',
      tableName: 'mobilization_forms',
      underscored: true,
    }
  );

  return MobilizationForm;
};
