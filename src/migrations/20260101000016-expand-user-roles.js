'use strict';

const NEW_ROLES = [
  'director',
  'scheme_manager',
  'center_coordinator',
  'mobilizer',
  'data_entry_operator',
  'verification_officer',
  'accountant',
];

module.exports = {
  up: async (queryInterface) => {
    for (const role of NEW_ROLES) {
      // ALTER TYPE ... ADD VALUE cannot run inside a multi-statement transaction
      // block together with other ADD VALUE calls on some PG versions, so each
      // runs as its own statement and is safely idempotent via IF NOT EXISTS.
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS '${role}';`
      );
    }
  },
  down: async () => {
    // Postgres does not support removing enum values. Down migration is a
    // deliberate no-op; roll back by restoring from a backup if ever needed.
  },
};
