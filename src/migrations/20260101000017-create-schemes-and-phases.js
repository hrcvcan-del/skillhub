'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('schemes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      funding_agency: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('scheme_phases', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      scheme_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'schemes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      target_candidates: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.ENUM('planning', 'active', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'planning',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('scheme_phases', ['scheme_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('scheme_phases');
    await queryInterface.dropTable('schemes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_scheme_phases_status";');
  },
};
