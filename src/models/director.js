'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Director extends Model {
    static associate(models) {
      Director.hasMany(models.BankTransactionAssignment, { foreignKey: 'director_id', as: 'assignments' });
    }
  }

  Director.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      notes: DataTypes.TEXT,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Director',
      tableName: 'directors',
      underscored: true,
    }
  );

  return Director;
};
