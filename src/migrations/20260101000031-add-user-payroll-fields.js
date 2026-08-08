'use strict';

// Salary + bank details for staff paid via the hourly attendance module
// (data_entry_operator, center_coordinator, or any other staff role) —
// same field set Trainer already has, on User instead since these are
// login accounts, not Trainer records. Nullable: only staff actually
// tracked here need them filled in.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'salary_amount', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    await queryInterface.addColumn('users', 'bank_account_number', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'ifsc_code', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'bank_name', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'bank_name');
    await queryInterface.removeColumn('users', 'ifsc_code');
    await queryInterface.removeColumn('users', 'bank_account_number');
    await queryInterface.removeColumn('users', 'salary_amount');
  },
};
