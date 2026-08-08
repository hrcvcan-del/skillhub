'use strict';

// One row per (trainer, calendar day) marked by HR — 'present' counts as
// 1 full day, 'half_day' as 0.5, 'absent' as 0 towards that month's
// attendance-based salary calculation (see src/utils/attendanceCalc.js).
// A day with no row at all also counts as 0 — HR must actively mark it,
// nothing is assumed present by default.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trainer_attendances', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      trainer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'trainers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      status: {
        type: Sequelize.ENUM('present', 'absent', 'half_day'),
        allowNull: false,
      },
      marked_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      remarks: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('trainer_attendances', {
      fields: ['trainer_id', 'date'],
      type: 'unique',
      name: 'trainer_attendances_trainer_id_date_unique',
    });
    await queryInterface.addIndex('trainer_attendances', ['date']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('trainer_attendances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_trainer_attendances_status";');
  },
};
