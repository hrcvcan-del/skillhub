'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class EquipmentInventory extends Model {
    static associate(models) {
      EquipmentInventory.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
    }
  }

  EquipmentInventory.init(
    {
      training_center_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      category: DataTypes.STRING,
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      unit_purchase_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      purchase_date: DataTypes.DATEONLY,
      vendor_name: DataTypes.STRING,
      condition: {
        type: DataTypes.ENUM('new', 'good', 'needs_repair', 'damaged', 'disposed'),
        allowNull: false,
        defaultValue: 'new',
      },
      warranty_expiry_date: DataTypes.DATEONLY,
      serial_number: DataTypes.STRING,
      notes: DataTypes.TEXT,
      last_maintenance_date: DataTypes.DATEONLY,
    },
    {
      sequelize,
      modelName: 'EquipmentInventory',
      tableName: 'equipment_inventory',
      underscored: true,
    }
  );

  return EquipmentInventory;
};
