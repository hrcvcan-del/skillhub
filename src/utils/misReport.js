// Builds the phase-wide MIS Excel export — a flat list, one row per
// enrolled candidate across every batch at every training center under a
// Scheme Phase. Used to track actual admissions against a phase's target
// (e.g. "700 of 5000 admitted so far"). Columns mirror the government
// MIS sample exactly.
const XLSX = require('xlsx');
const { toDDMMYYYY } = require('./reportDate');

const HEADERS = [
  'Sr.\r\nNo',
  'Name',
  'Gender',
  'Category',
  'Student District',
  'Aadhar No.',
  'Date of  Birth',
  'PWD',
  'Orphen',
  'Highest Qualification',
  'Contact No.',
  'Course',
  'Name of Training Partner ',
  'Training Center District',
  'Training Center full address with pin code',
  'Start Date',
  'End Date',
  'Batch Name',
];

// rows: array of { student, batch } — batch must include `course` and
// `trainingCenter` associations.
function buildMisWorkbook(rows) {
  const aoa = [HEADERS];

  rows.forEach((row, idx) => {
    const s = row.student;
    const batch = row.batch;
    const course = batch.course;
    const center = batch.trainingCenter;
    aoa.push([
      idx + 1,
      s.full_name || s.name,
      s.gender || '',
      s.caste_category || '',
      s.district || '',
      s.aadhaar_number || '',
      toDDMMYYYY(s.date_of_birth),
      s.pwd || '',
      s.orphan || '',
      s.education || '',
      s.phone || '',
      course ? course.name : '',
      course ? course.sector_skill_council_short_name || '' : '',
      center ? center.district || '' : '',
      center ? center.address || '' : '',
      toDDMMYYYY(batch.start_date),
      toDDMMYYYY(batch.end_date),
      batch.report_batch_number || batch.batch_code,
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 15 },
    { wch: 12 },
    { wch: 6 },
    { wch: 8 },
    { wch: 16 },
    { wch: 13 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 34 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildMisWorkbook };
