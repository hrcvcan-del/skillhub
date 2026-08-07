'use strict';

// Rounds out the fields needed for the MIS (phase-wide) Excel and the
// Commencement Letter, on top of the joining-report fields added in the
// previous migration.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('students', 'orphan', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('training_centers', 'district', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('courses', 'duration_hours', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('courses', 'training_hours_per_day', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('courses', 'lodging_boarding', { type: Sequelize.STRING, allowNull: true });
    // Short acronym form of sector_skill_council (e.g. "AMHSSC"), used as
    // "Name of Training Partner" on the MIS report — distinct from the full
    // "Name, City." form used in the Commencement Letter's sender line.
    await queryInterface.addColumn('courses', 'sector_skill_council_short_name', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('batches', 'weekly_holiday', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('batches', 'sanctioned_batch_size', { type: Sequelize.INTEGER, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('batches', 'sanctioned_batch_size');
    await queryInterface.removeColumn('batches', 'weekly_holiday');
    await queryInterface.removeColumn('courses', 'sector_skill_council_short_name');
    await queryInterface.removeColumn('courses', 'lodging_boarding');
    await queryInterface.removeColumn('courses', 'training_hours_per_day');
    await queryInterface.removeColumn('courses', 'duration_hours');
    await queryInterface.removeColumn('training_centers', 'district');
    await queryInterface.removeColumn('students', 'orphan');
  },
};
