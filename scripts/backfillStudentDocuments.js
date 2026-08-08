// One-off backfill: creates the 5-document checklist rows for every
// student that predates the Document Verification feature (new students
// get these automatically via enrollmentService.createEnrollment ->
// ensureStudentDocuments). Idempotent — safe to re-run; findOrCreate
// skips students that already have their rows.
//
// Usage: node scripts/backfillStudentDocuments.js
require('dotenv').config();
const { Student } = require('../src/models');
const { ensureStudentDocuments } = require('../src/utils/studentDocumentService');

async function main() {
  const students = await Student.findAll({ attributes: ['id', 'name'] });
  console.log(`Found ${students.length} student(s). Ensuring document checklist rows...`);

  let created = 0;
  for (const student of students) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await ensureStudentDocuments(student.id);
    created += rows.length;
  }

  console.log(`Done. Ensured document rows for ${students.length} student(s) (${created} row references checked).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
