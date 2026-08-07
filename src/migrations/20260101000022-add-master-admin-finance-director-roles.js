'use strict';

// Adds 'master_admin' (top-of-hierarchy super-admin, bypasses every
// requireRole() check — see src/middleware/roles.js) and 'finance_director'
// (the only role, besides master_admin, that can see Finance/Expenses).
// Existing 'accountant' users are migrated to 'finance_director' — that
// role is retired. Postgres can't remove enum values, so 'accountant'
// stays defined on the enum type but unused (harmless).
module.exports = {
  up: async (queryInterface) => {
    // ALTER TYPE ... ADD VALUE cannot run inside the same multi-statement
    // transaction as other ADD VALUE calls on some PG versions, so each
    // runs as its own statement and is safely idempotent via IF NOT EXISTS.
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'master_admin';`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'finance_director';`);
  },
  down: async () => {
    // Postgres does not support removing enum values. Down migration is a
    // deliberate no-op; roll back by restoring from a backup if ever needed.
  },
};
