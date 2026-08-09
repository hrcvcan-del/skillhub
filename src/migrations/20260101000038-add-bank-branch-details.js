'use strict';

// Fourth field for the bank document scanner (alongside account number,
// IFSC, bank name): branch name/address, as printed on a passbook or
// cheque — e.g. "I.E. Chikalthana, Aurangabad".
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('trainers', 'bank_branch', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'bank_branch', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('training_centers', 'owner_bank_branch', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('training_centers', 'owner_bank_branch');
    await queryInterface.removeColumn('users', 'bank_branch');
    await queryInterface.removeColumn('trainers', 'bank_branch');
  },
};
