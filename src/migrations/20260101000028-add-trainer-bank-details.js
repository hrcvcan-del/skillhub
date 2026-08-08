'use strict';

// Trainers already had bank_account_number; IFSC code and bank name are
// needed to generate the NEFT/RTGS bank-upload Excel (see
// src/utils/neftExport.js) — both are mandatory/expected columns in the
// bank's own bulk-payment template.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('trainers', 'ifsc_code', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('trainers', 'bank_name', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('trainers', 'bank_name');
    await queryInterface.removeColumn('trainers', 'ifsc_code');
  },
};
