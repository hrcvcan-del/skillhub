'use strict';

// Two new roles:
// - 'training_center': a login for the center/institute itself — can create
//   batches and add students at their own center (via TrainingCenter.
//   coordinator_id, same link/scoping mechanism as center_coordinator), and
//   nothing else. See src/utils/centerScope.js.
// - 'center_manager': add-only access — can create a Training Center,
//   Center Coordinator, Data Entry Operator, Trainer, or Mobilizer account,
//   then done; no list/view access to any of them. See
//   src/utils/roles.js (CENTER_MANAGER_ASSIGNABLE_ROLES) and
//   src/controllers/centerManagerController.js.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'training_center';`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'center_manager';`);
  },
  down: async () => {
    // Postgres does not support removing enum values. Down migration is a
    // deliberate no-op; roll back by restoring from a backup if ever needed.
  },
};
