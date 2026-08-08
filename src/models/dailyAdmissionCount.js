'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class DailyAdmissionCount extends Model {
    static associate(models) {
      DailyAdmissionCount.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      DailyAdmissionCount.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      DailyAdmissionCount.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
    }
  }

  DailyAdmissionCount.init(
    {
      training_center_id: { type: DataTypes.INTEGER, allowNull: false },
      trainer_id: { type: DataTypes.INTEGER, allowNull: false },
      count_date: { type: DataTypes.DATEONLY, allowNull: false },
      admissions_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      recorded_by: DataTypes.INTEGER,
      remarks: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'DailyAdmissionCount',
      tableName: 'daily_admission_counts',
      underscored: true,
    }
  );

  return DailyAdmissionCount;
};
