'use strict';

// One row per (staff user, calendar day) — unlike trainer attendance
// (present/absent/half_day), staff attendance is clock in/out time, and
// pay is computed from actual hours worked: monthly salary -> per-day
// rate -> per-day rate / 8 -> per-hour rate -> hours_worked * per-hour
// rate. hours_worked is stored (not recomputed on read) so a later change
// to a user's salary_amount doesn't retroactively change what a past day
// was worth.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staff_attendances', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      in_time: { type: Sequelize.TIME, allowNull: true },
      out_time: { type: Sequelize.TIME, allowNull: true },
      hours_worked: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      source: {
        type: Sequelize.ENUM('manual', 'self', 'excel_upload'),
        allowNull: false,
        defaultValue: 'manual',
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

    await queryInterface.addConstraint('staff_attendances', {
      fields: ['user_id', 'date'],
      type: 'unique',
      name: 'staff_attendances_user_id_date_unique',
    });
    await queryInterface.addIndex('staff_attendances', ['date']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('staff_attendances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_staff_attendances_source";');
  },
};
