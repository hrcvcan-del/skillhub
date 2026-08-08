'use strict';

// IFSC code and bank name for the landlord/owner, alongside the existing
// owner_bank_account_number — needed to generate the rent NEFT/RTGS
// bank-upload Excel (same template as trainer/staff salary, see
// src/utils/neftExport.js).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('training_centers', 'owner_ifsc_code', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('training_centers', 'owner_bank_name', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('training_centers', 'owner_bank_name');
    await queryInterface.removeColumn('training_centers', 'owner_ifsc_code');
  },
};
