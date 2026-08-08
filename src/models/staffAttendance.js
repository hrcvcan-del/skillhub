'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class StaffAttendance extends Model {
    static associate(models) {
      StaffAttendance.belongsTo(models.User, { foreignKey: 'user_id', as: 'staffUser' });
      StaffAttendance.belongsTo(models.User, { foreignKey: 'marked_by', as: 'markedByUser' });
    }
  }

  StaffAttendance.init(
    {
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      in_time: DataTypes.TIME,
      out_time: DataTypes.TIME,
      hours_worked: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      source: {
        type: DataTypes.ENUM('manual', 'self', 'excel_upload'),
        allowNull: false,
        defaultValue: 'manual',
      },
      marked_by: DataTypes.INTEGER,
      remarks: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'StaffAttendance',
      tableName: 'staff_attendances',
      underscored: true,
    }
  );

  return StaffAttendance;
};
