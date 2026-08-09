'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'aadhar_card_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'education_certificate_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('trainers', 'aadhar_card_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('trainers', 'education_certificate_url', { type: Sequelize.STRING, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'aadhar_card_url');
    await queryInterface.removeColumn('users', 'education_certificate_url');
    await queryInterface.removeColumn('trainers', 'aadhar_card_url');
    await queryInterface.removeColumn('trainers', 'education_certificate_url');
  },
};
