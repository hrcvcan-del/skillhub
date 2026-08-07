'use strict';

// Adds the fields needed to generate the government "Candidate Application
// and Joining Data" Excel report for a batch: caste/category detail and
// PwD/non-creamy-layer flags on students, a Sector Skill Council name on
// courses, a Work Order No + report-facing Batch Number on batches, and an
// official long-form report heading on schemes.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // caste_category was a fixed ENUM (General/OBC/SC/ST/EWS/Other), but the
    // government report also uses categories like NT-B, NT-C, VJ, SBC that
    // vary by scheme/state — widen it to free text instead of maintaining an
    // ever-growing enum.
    await queryInterface.changeColumn('students', 'caste_category', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_students_caste_category";').catch(() => {});

    await queryInterface.addColumn('students', 'caste_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'non_creamy_layer', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'pwd', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('courses', 'sector_skill_council', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('batches', 'work_order_no', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('batches', 'report_batch_number', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('schemes', 'report_heading', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('schemes', 'report_heading');
    await queryInterface.removeColumn('batches', 'report_batch_number');
    await queryInterface.removeColumn('batches', 'work_order_no');
    await queryInterface.removeColumn('courses', 'sector_skill_council');
    await queryInterface.removeColumn('students', 'pwd');
    await queryInterface.removeColumn('students', 'non_creamy_layer');
    await queryInterface.removeColumn('students', 'caste_name');
    await queryInterface.changeColumn('students', 'caste_category', { type: Sequelize.STRING, allowNull: true });
  },
};
