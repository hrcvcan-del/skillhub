'use strict';

// Two new suspense-assignment targets, alongside the existing
// expense_id/trainer_salary_payment_id/rent_payment_id: Director Expense
// and Training Partner Payment.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bank_transaction_assignments', 'director_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'directors', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('bank_transaction_assignments', 'training_partner_bill_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'training_partner_bills', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('bank_transaction_assignments', 'training_partner_bill_id');
    await queryInterface.removeColumn('bank_transaction_assignments', 'director_id');
  },
};
