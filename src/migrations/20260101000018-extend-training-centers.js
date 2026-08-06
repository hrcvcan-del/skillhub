'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('training_centers', 'scheme_phase_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'scheme_phases', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('training_centers', 'coordinator_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('training_centers', 'owner_bank_account_number', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('training_centers', 'owner_upi_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('training_centers', 'planned_closure_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addIndex('training_centers', ['scheme_phase_id']);
    await queryInterface.addIndex('training_centers', ['coordinator_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('training_centers', 'scheme_phase_id');
    await queryInterface.removeColumn('training_centers', 'coordinator_id');
    await queryInterface.removeColumn('training_centers', 'owner_bank_account_number');
    await queryInterface.removeColumn('training_centers', 'owner_upi_id');
    await queryInterface.removeColumn('training_centers', 'planned_closure_date');
  },
};
