'use strict';

// One row per (student, mandatory document) — a physical-document
// checklist a Data Entry Operator marks after checking the student's
// file. Document types are the 5 in src/utils/documentTypes.js.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_documents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'students', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      document_type: {
        type: Sequelize.ENUM(
          'aadhaar',
          'caste_certificate',
          'leaving_certificate_marksheet',
          'income_certificate_non_creamy_layer',
          'photo'
        ),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('submitted', 'not_submitted'),
        allowNull: false,
        defaultValue: 'not_submitted',
      },
      remarks: { type: Sequelize.STRING, allowNull: true },
      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('student_documents', {
      fields: ['student_id', 'document_type'],
      type: 'unique',
      name: 'student_documents_student_id_document_type_unique',
    });
    await queryInterface.addIndex('student_documents', ['verified_by']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('student_documents');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_documents_document_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_documents_status";');
  },
};
