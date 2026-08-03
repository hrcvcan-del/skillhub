'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('expenses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      training_center_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'training_centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      category: {
        type: Sequelize.ENUM(
          'utilities',
          'marketing',
          'maintenance',
          'supplies',
          'travel',
          'salaries_admin',
          'misc'
        ),
        allowNull: false,
        defaultValue: 'misc',
      },
      description: { type: Sequelize.STRING, allowNull: true },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      expense_date: { type: Sequelize.DATEONLY, allowNull: false },
      receipt_file_url: { type: Sequelize.STRING, allowNull: true },
      recorded_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('expenses', ['training_center_id']);
    await queryInterface.addIndex('expenses', ['expense_date']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('expenses');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_expenses_category";');
  },
};
