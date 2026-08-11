'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Batch extends Model {
    static associate(models) {
      Batch.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course' });
      Batch.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      Batch.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      Batch.hasMany(models.Enrollment, { foreignKey: 'batch_id', as: 'enrollments' });
      Batch.belongsTo(models.User, { foreignKey: 'document_verifier_id', as: 'documentVerifier' });
      // Deliberately a separate assignment from document_verifier_id — a
      // center may want a different Data Entry Operator doing admissions
      // data entry than the one checking submitted documents.
      Batch.belongsTo(models.User, { foreignKey: 'student_entry_operator_id', as: 'studentEntryOperator' });
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
      // Government sanction/work order reference and the report-facing
      // batch sequence number — both distinct from the internal batch_code
      // and used only on the joining-data Excel report.
      work_order_no: DataTypes.STRING,
      report_batch_number: DataTypes.STRING,
      weekly_holiday: DataTypes.STRING,
      sanctioned_batch_size: DataTypes.INTEGER,
      document_verifier_id: DataTypes.INTEGER,
      student_entry_operator_id: DataTypes.INTEGER,
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
