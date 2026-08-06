'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SchemePhase extends Model {
    static associate(models) {
      SchemePhase.belongsTo(models.Scheme, { foreignKey: 'scheme_id', as: 'scheme' });
      SchemePhase.hasMany(models.TrainingCenter, { foreignKey: 'scheme_phase_id', as: 'centers' });
    }
  }

  SchemePhase.init(
    {
      scheme_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      target_candidates: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      start_date: DataTypes.DATEONLY,
      end_date: DataTypes.DATEONLY,
      status: {
        type: DataTypes.ENUM('planning', 'active', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'planning',
      },
      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'SchemePhase',
      tableName: 'scheme_phases',
      underscored: true,
    }
  );

  return SchemePhase;
};
