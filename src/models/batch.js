'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Batch extends Model {
    static associate(models) {
      Batch.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course' });
      Batch.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      Batch.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      Batch.hasMany(models.Enrollment, { foreignKey: 'batch_id', as: 'enrollments' });
    }
  }

  Batch.init(
    {
      course_id: { type: DataTypes.INTEGER, allowNull: false },
      training_center_id: { type: DataTypes.INTEGER, allowNull: false },
      trainer_id: { type: DataTypes.INTEGER, allowNull: true },
      batch_code: { type: DataTypes.STRING, allowNull: false, unique: true },
      start_date: { type: DataTypes.DATEONLY, allowNull: false },
      end_date: { type: DataTypes.DATEONLY, allowNull: false },
      schedule_days: DataTypes.STRING,
      start_time: DataTypes.TIME,
      end_time: DataTypes.TIME,
      capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
      status: {
        type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'upcoming',
      },
    },
    {
      sequelize,
      modelName: 'Batch',
      tableName: 'batches',
      underscored: true,
    }
  );

  return Batch;
};
