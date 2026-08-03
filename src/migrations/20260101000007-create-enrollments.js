'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('enrollments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'students', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      batch_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'batches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      enrollment_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_fee: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      fee_paid: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      fee_due: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discount_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'dropped'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('enrollments', ['batch_id']);
    await queryInterface.addIndex('enrollments', ['student_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('enrollments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_enrollments_status";');
  },
};
