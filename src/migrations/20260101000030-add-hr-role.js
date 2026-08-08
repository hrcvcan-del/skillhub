'use strict';

// New role: HR marks daily trainer attendance and generates the
// attendance-based monthly salary + bank-upload Excel. See
// src/utils/roles.js (ATTENDANCE_ROLES / PAYROLL_GENERATE_ROLES) and
// src/routes/attendance.js.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'hr';`);
  },
  down: async () => {
    // Postgres does not support removing enum values. Down migration is a
    // deliberate no-op; roll back by restoring from a backup if ever needed.
  },
};
