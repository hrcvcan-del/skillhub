'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('fee_payments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      enrollment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'enrollments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      payment_date: { type: Sequelize.DATEONLY, allowNull: false },
      payment_mode: {
        type: Sequelize.ENUM('cash', 'upi', 'card', 'bank_transfer'),
        allowNull: false,
        defaultValue: 'cash',
      },
      receipt_number: { type: Sequelize.STRING, allowNull: true },
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
    await queryInterface.addIndex('fee_payments', ['enrollment_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('fee_payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fee_payments_payment_mode";');
  },
};
