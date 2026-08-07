// Builds the "Candidate Application and Joining Data" Excel export for a
// single batch — merged institute/course/batch header block followed by one
// row per enrolled candidate (max ~30 per batch). Layout mirrors the
// government-supplied sample exactly (16 columns A-P, same merge ranges).
const XLSX = require('xlsx');
const { toDDMMYYYY } = require('./reportDate');

const HEADERS = [
  'Sr.No',
  'Full Name of Candidate',
  'Mobile Number ',
  'Date of Birth',
  'Aadhar UID',
  'Permanant Address',
  'Taluka ',
  'District ',
  'Category',
  'Name of Caste As per Caste Certificate ',
  'Non Creamy Layer (Y/N)',
  'Gender',
  'PwD (Y/N)',
  'Highest Qualification',
  'Date of Joining ',
  'Remark ',
];

function resolveSchemeHeading(batch) {
  const scheme = batch.trainingCenter && batch.trainingCenter.schemePhase && batch.trainingCenter.schemePhase.scheme;
  return (scheme && scheme.report_heading) || '';
}

// enrollments: Enrollment rows (each with an included `student`), already
// filtered/sorted by the caller.
function buildJoiningWorkbook(batch, enrollments) {
  const course = batch.course;
  const center = batch.trainingCenter;

  const tcLine = center ? `${center.name || ''}${center.district ? ' DIST. ' + center.district : ''}`.trim() : '';
  const sscLine =
    course && course.sector_skill_council
      ? `Skill Development Training Program by ${course.sector_skill_council}`
      : 'Skill Development Training Program';

  const rows = [
    [resolveSchemeHeading(batch)],
    [sscLine],
    ['Candidate Application and Joining Data'],
    ['Name of Course', '', course ? course.name : ''],
    ['Name of TC and Address', '', tcLine],
    ['Work order No and Date', '', batch.work_order_no || ''],
    ['Batch Number', '', batch.report_batch_number || ''],
    ['Course Start Date :', '', `${toDDMMYYYY(batch.start_date)}   Course End Date : ${toDDMMYYYY(batch.end_date)}`],
    HEADERS,
  ];

  enrollments.forEach((enrollment, idx) => {
    const s = enrollment.student;
    rows.push([
      idx + 1,
      s.full_name || s.name,
      s.phone || '',
      toDDMMYYYY(s.date_of_birth),
      s.aadhaar_number || '',
      s.address || '',
      s.taluka || '',
      s.district || '',
      s.caste_category || '',
      s.caste_name || '',
      s.non_creamy_layer || '',
      s.gender || '',
      s.pwd || '',
      s.education || '',
      toDDMMYYYY(enrollment.enrollment_date),
      'JOINED',
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const lastCol = HEADERS.length - 1;
  sheet['!merges'] = [
    { s: { c: 0, r: 0 }, e: { c: lastCol, r: 0 } },
    { s: { c: 0, r: 1 }, e: { c: lastCol, r: 1 } },
    { s: { c: 0, r: 2 }, e: { c: lastCol, r: 2 } },
    ...[3, 4, 5, 6, 7].flatMap((r) => [
      { s: { c: 0, r }, e: { c: 1, r } },
      { s: { c: 2, r }, e: { c: lastCol, r } },
    ]),
  ];
  sheet['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 13 },
    { wch: 12 },
    { wch: 15 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildJoiningWorkbook };
