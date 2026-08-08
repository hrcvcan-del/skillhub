'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TrainerAttendance extends Model {
    static associate(models) {
      TrainerAttendance.belongsTo(models.Trainer, { foreignKey: 'trainer_id', as: 'trainer' });
      TrainerAttendance.belongsTo(models.User, { foreignKey: 'marked_by', as: 'markedByUser' });
    }
  }

  TrainerAttendance.init(
    {
      trainer_id: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.ENUM('present', 'absent', 'half_day'), allowNull: false },
      marked_by: DataTypes.INTEGER,
      remarks: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'TrainerAttendance',
      tableName: 'trainer_attendances',
      underscored: true,
    }
  );

  return TrainerAttendance;
};
