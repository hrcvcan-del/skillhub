'use strict';

// Adds "Feedback Form" as a 6th mandatory document alongside the original
// 5 (Aadhar, Caste Certificate, Leaving Certificate/Marksheet, Income
// Certificate/Non-Creamy Layer, Photo) in the Document Verification
// checklist — see src/utils/documentTypes.js, the single source of truth
// the model/controller/views all read from.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_student_documents_document_type" ADD VALUE IF NOT EXISTS 'feedback_form';`
    );
  },
  down: async () => {
    // Postgres does not support removing enum values. Down migration is a
    // deliberate no-op; roll back by restoring from a backup if ever needed.
  },
};
