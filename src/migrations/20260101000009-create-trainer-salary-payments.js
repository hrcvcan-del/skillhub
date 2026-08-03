'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trainer_salary_payments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      trainer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'trainers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      training_center_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'training_centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      for_month: { type: Sequelize.INTEGER, allowNull: false },
      for_year: { type: Sequelize.INTEGER, allowNull: false },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      bonus_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      deduction_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      payment_date: { type: Sequelize.DATEONLY, allowNull: true },
      payment_mode: {
        type: Sequelize.ENUM('cash', 'upi', 'card', 'bank_transfer'),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'partially_paid'),
        allowNull: false,
        defaultValue: 'pending',
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
    await queryInterface.addIndex('trainer_salary_payments', ['trainer_id', 'for_year', 'for_month']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('trainer_salary_payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_trainer_salary_payments_payment_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_trainer_salary_payments_status";');
  },
};
