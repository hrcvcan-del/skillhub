'use strict';

// Tracks money advanced to a trainer ahead of their salary. Auto-deducted
// from that trainer's NEXT generated salary due (see
// salaryPaymentController.generateForMonth) — status flips from 'pending'
// to 'deducted' and deducted_in_salary_payment_id records which payment
// absorbed it.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trainer_advances', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      trainer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'trainers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      advance_date: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'deducted'),
        allowNull: false,
        defaultValue: 'pending',
      },
      deducted_in_salary_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'trainer_salary_payments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
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
    await queryInterface.addIndex('trainer_advances', ['trainer_id']);
    await queryInterface.addIndex('trainer_advances', ['status']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('trainer_advances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_trainer_advances_status";').catch(() => {});
  },
};
