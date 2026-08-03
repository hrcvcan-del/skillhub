'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('rent_payments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      training_center_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'training_centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      for_month: { type: Sequelize.INTEGER, allowNull: false },
      for_year: { type: Sequelize.INTEGER, allowNull: false },
      amount_due: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      amount_paid: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      due_date: { type: Sequelize.DATEONLY, allowNull: false },
      paid_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'overdue'),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_mode: {
        type: Sequelize.ENUM('cash', 'upi', 'card', 'bank_transfer'),
        allowNull: true,
      },
      recorded_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('rent_payments', ['training_center_id', 'for_year', 'for_month']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('rent_payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rent_payments_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rent_payments_payment_mode";');
  },
};
