'use strict';

// Tracks the physical admission-form handoff: a Trainer collects forms in
// the field and hands them to a Center Coordinator, who logs how many
// they received; Head Office later reviews and records how many were
// actually accepted (and can correct the submitted count if it was
// miscounted at intake).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('mobilization_forms', {
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
      center_coordinator_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      form_date: { type: Sequelize.DATEONLY, allowNull: false },
      forms_submitted_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      forms_accepted_count: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'reviewed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addIndex('mobilization_forms', ['training_center_id']);
    await queryInterface.addIndex('mobilization_forms', ['trainer_id']);
    await queryInterface.addIndex('mobilization_forms', ['center_coordinator_id']);
    await queryInterface.addIndex('mobilization_forms', ['status']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('mobilization_forms');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mobilization_forms_status";');
  },
};
