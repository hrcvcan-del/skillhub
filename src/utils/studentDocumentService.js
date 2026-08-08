// Documents belong to the student, not any one enrollment (the same
// physical Aadhar/caste-certificate/etc. file doesn't change if the
// student transfers batches), so the 5 mandatory checklist rows are
// guaranteed to exist once per student rather than once per enrollment.
// This is called from enrollmentService.createEnrollment() (idempotent —
// safe to call again on a transfer/re-enrollment) and from the one-off
// backfill script for students that predate this feature.
const { StudentDocument } = require('../models');
const { DOCUMENT_TYPE_KEYS } = require('./documentTypes');

async function ensureStudentDocuments(studentId, { transaction } = {}) {
  const rows = await Promise.all(
    DOCUMENT_TYPE_KEYS.map((document_type) =>
      StudentDocument.findOrCreate({
        where: { student_id: studentId, document_type },
        defaults: { student_id: studentId, document_type, status: 'not_submitted' },
        transaction,
      })
    )
  );
  return rows.map(([row]) => row);
}

module.exports = { ensureStudentDocuments };
