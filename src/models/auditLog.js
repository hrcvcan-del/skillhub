'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  AuditLog.init(
    {
      user_id: DataTypes.INTEGER,
      action: { type: DataTypes.STRING, allowNull: false },
      entity_type: { type: DataTypes.STRING, allowNull: false },
      entity_id: DataTypes.INTEGER,
      old_value: DataTypes.JSONB,
      new_value: DataTypes.JSONB,
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      underscored: true,
      updatedAt: false,
    }
  );

  return AuditLog;
};
