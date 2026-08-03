'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trainers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: true, unique: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      specialization: { type: Sequelize.STRING, allowNull: true },
      qualification: { type: Sequelize.STRING, allowNull: true },
      joining_date: { type: Sequelize.DATEONLY, allowNull: true },
      exit_date: { type: Sequelize.DATEONLY, allowNull: true },
      salary_type: {
        type: Sequelize.ENUM('monthly', 'per_batch', 'hourly'),
        allowNull: false,
        defaultValue: 'monthly',
      },
      salary_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      bank_account_number: { type: Sequelize.STRING, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('trainers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_trainers_salary_type";');
  },
};
