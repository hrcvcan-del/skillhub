'use strict';

// New role: 'rent_coordinator' — a narrow login scoped entirely to Center
// Rent Management. Can view the rent list (including filtering to
// pending), and record a payment against a due rent (marking it paid /
// partially paid). Cannot generate a month's rent dues (single or
// bulk-batch) or manually create a rent record — those stay
// finance_director/master_admin only. See src/utils/roles.js
// (RENT_VIEW_ROLES, RENT_PAY_ROLES) and src/routes/rentPayments.js.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'rent_coordinator';`);
  },
  down: async () => {
    // Postgres does not support removing enum values. Down migration is a
    // deliberate no-op; roll back by restoring from a backup if ever needed.
  },
};
