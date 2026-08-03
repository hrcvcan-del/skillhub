'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('equipment_inventory', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      training_center_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'training_centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      category: { type: Sequelize.STRING, allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      unit_purchase_cost: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      purchase_date: { type: Sequelize.DATEONLY, allowNull: true },
      vendor_name: { type: Sequelize.STRING, allowNull: true },
      condition: {
        type: Sequelize.ENUM('new', 'good', 'needs_repair', 'damaged', 'disposed'),
        allowNull: false,
        defaultValue: 'new',
      },
      warranty_expiry_date: { type: Sequelize.DATEONLY, allowNull: true },
      serial_number: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      last_maintenance_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('equipment_inventory', ['training_center_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('equipment_inventory');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_equipment_inventory_condition";');
  },
};
