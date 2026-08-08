'use strict';

// Which data_entry_operator/verification_officer is responsible for
// checking this batch's student documents — set by admin/director so an
// operator can find "my batches" instead of picking from the full list,
// and so it's clear who owns a batch even before any document has
// actually been checked yet (the Operator Monitoring report at
// /documents/reports/monitor answers "who checked what" from the
// StudentDocument.verified_by trail; this answers "who's supposed to").
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('batches', 'document_verifier_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('batches', ['document_verifier_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('batches', 'document_verifier_id');
  },
};
