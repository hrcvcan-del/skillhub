'use strict';

// A third checkpoint alongside submitted/accepted: after Head Office
// accepts a batch of forms, someone physically re-verifies them (cross-
// checks details against the originals) before the students behind them
// get entered into the system as real Student/Enrollment records — see
// the Mobilization Summary funnel (submitted -> accepted -> verified ->
// actually enrolled).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('mobilization_forms', 'forms_verified_count', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('mobilization_forms', 'forms_verified_count');
  },
};
