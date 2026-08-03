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
