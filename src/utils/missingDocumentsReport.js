// Builds the "Missing Documents" Excel export — one row per enrolled
// student who has at least one of the 5 mandatory documents still marked
// not_submitted, listing exactly which ones.
const XLSX = require('xlsx');
const { toDDMMYYYY } = require('./reportDate');
const { combineFullName } = require('./studentName');

const HEADERS = ['Student Name', 'Center', 'Batch', 'Missing Documents', 'Submitted', 'Total', 'Enrollment Date'];

// rows: array of { student, enrollment, batch, center, missingLabels, submittedCount, totalCount }
function buildMissingDocumentsWorkbook(rows) {
  const aoa = [HEADERS];

  rows.forEach((r) => {
    aoa.push([
      combineFullName(r.student),
      r.center ? r.center.name : '',
      r.batch ? r.batch.batch_code : '',
      r.missingLabels.join(', '),
      r.submittedCount,
      r.totalCount,
      r.enrollment ? toDDMMYYYY(r.enrollment.enrollment_date) : '',
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 45 }, { wch: 10 }, { wch: 8 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Missing Documents');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildMissingDocumentsWorkbook };
