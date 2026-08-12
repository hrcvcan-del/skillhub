'use strict';

// A Center Coordinator / Data Entry Operator's own daily work log — what
// they actually did on a given day, in their own words (plus a standard
// "type" pick for quick scanning) — so an admin/director can monitor
// their work over time without having to ask. See src/utils/roles.js
// (WORK_REMARK_VIEW_ROLES) for who can see everyone's entries vs. just
// their own.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('work_remarks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      remark_date: { type: Sequelize.DATEONLY, allowNull: false },
      // A standard, quick-pick label (see src/utils/workRemarkTypes.js) —
      // free text is still allowed via "Other" so it never blocks an entry
      // that doesn't fit the list.
      work_type: { type: Sequelize.STRING, allowNull: false },
      remark: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('work_remarks', ['user_id', 'remark_date']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('work_remarks');
  },
};
