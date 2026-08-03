'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('batches', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'courses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      training_center_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'training_centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      trainer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'trainers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      batch_code: { type: Sequelize.STRING, allowNull: false, unique: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      schedule_days: { type: Sequelize.STRING, allowNull: true },
      start_time: { type: Sequelize.TIME, allowNull: true },
      end_time: { type: Sequelize.TIME, allowNull: true },
      capacity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 20 },
      status: {
        type: Sequelize.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'upcoming',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('batches', ['training_center_id']);
    await queryInterface.addIndex('batches', ['course_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('batches');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_batches_status";');
  },
};
