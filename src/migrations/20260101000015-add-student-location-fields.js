'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('students', 'aadhaar_number', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'taluka', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('students', 'district', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('students', 'aadhaar_number');
    await queryInterface.removeColumn('students', 'taluka');
    await queryInterface.removeColumn('students', 'district');
  },
};
