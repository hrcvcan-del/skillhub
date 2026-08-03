'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('students', 'middle_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'full_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'education', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'caste_category', {
      type: Sequelize.ENUM('General', 'OBC', 'SC', 'ST', 'EWS', 'Other'),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('students', 'middle_name');
    await queryInterface.removeColumn('students', 'full_name');
    await queryInterface.removeColumn('students', 'education');
    await queryInterface.removeColumn('students', 'caste_category');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_students_caste_category";');
  },
};
