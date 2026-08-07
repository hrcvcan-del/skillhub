'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Course extends Model {
    static associate(models) {
      Course.hasMany(models.Batch, { foreignKey: 'course_id', as: 'batches' });
    }
  }

  Course.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      category: DataTypes.STRING,
      duration_weeks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      fee_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      // Full "Name, City." form — used in the joining-report heading and the
      // Commencement Letter's sender line, e.g. "Apparel Made-Ups & Home
      // Furnishing Sector Skills Council, New Delhi."
      sector_skill_council: DataTypes.STRING,
      // Short acronym form (e.g. "AMHSSC") — used as "Name of Training
      // Partner" on the MIS report.
      sector_skill_council_short_name: DataTypes.STRING,
      duration_hours: DataTypes.INTEGER,
      training_hours_per_day: DataTypes.INTEGER,
      lodging_boarding: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Course',
      tableName: 'courses',
      underscored: true,
    }
  );

  return Course;
};
