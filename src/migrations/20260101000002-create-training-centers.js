'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('training_centers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      address: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      capacity: { type: Sequelize.INTEGER, allowNull: true },
      monthly_rent_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      landlord_name: { type: Sequelize.STRING, allowNull: true },
      landlord_contact: { type: Sequelize.STRING, allowNull: true },
      lease_start_date: { type: Sequelize.DATEONLY, allowNull: true },
      lease_end_date: { type: Sequelize.DATEONLY, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('training_centers');
  },
};
