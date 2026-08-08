'use strict';

// The layer BEFORE a physical form ever changes hands: a mobilizer calls
// a trainer daily and asks how many admissions they've done that day.
// One row per (trainer, center, day) — re-logging the same day updates
// it in place rather than duplicating, since a mobilizer might call the
// same trainer more than once in a day and needs to correct the count.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('daily_admission_counts', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      training_center_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'training_centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      trainer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'trainers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      count_date: { type: Sequelize.DATEONLY, allowNull: false },
      admissions_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      recorded_by: {
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

    await queryInterface.addConstraint('daily_admission_counts', {
      fields: ['training_center_id', 'trainer_id', 'count_date'],
      type: 'unique',
      name: 'daily_admission_counts_center_trainer_date_unique',
    });
    await queryInterface.addIndex('daily_admission_counts', ['trainer_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('daily_admission_counts');
  },
};
