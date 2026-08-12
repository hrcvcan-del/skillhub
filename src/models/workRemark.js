'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class WorkRemark extends Model {
    static associate(models) {
      WorkRemark.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  WorkRemark.init(
    {
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      remark_date: { type: DataTypes.DATEONLY, allowNull: false },
      work_type: { type: DataTypes.STRING, allowNull: false },
      remark: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'WorkRemark',
      tableName: 'work_remarks',
      underscored: true,
    }
  );

  return WorkRemark;
};
