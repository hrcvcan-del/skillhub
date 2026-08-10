// Parses a bulk-upload Excel/CSV file of Trainers (one row per trainer).
// Mirrors centerBulkUpload.js / inventoryBulkUpload.js: the template's
// headers are fully under our control, so match by normalized exact text
// rather than fuzzy aliases.
const XLSX = require('xlsx');
const { parseDateValue } = require('./bankStatementParser');

const SALARY_TYPES = ['monthly', 'per_batch', 'hourly'];

const COLUMNS = [
  { key: 'name', header: 'Trainer Name*', required: true },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'specialization', header: 'Specialization' },
  { key: 'qualification', header: 'Qualification' },
  { key: 'joining_date', header: 'Joining Date (DD/MM/YYYY)' },
  { key: 'salary_type', header: 'Salary Type (monthly/per_batch/hourly)' },
  { key: 'salary_amount', header: 'Salary Amount*', required: true },
  { key: 'bank_account_number', header: 'Bank Account Number' },
  { key: 'ifsc_code', header: 'IFSC Code' },
  { key: 'bank_name', header: 'Bank Name' },
  { key: 'bank_branch', header: 'Bank Branch' },
];

const EXAMPLE_ROW = [
  'Ramesh Kulkarni', 'ramesh.k@example.com', '9876543210', 'Electrical Wiring', 'ITI Electrician',
  '01/04/2026', 'monthly', 20000, '', '', '', '',
];

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildTrainerTemplateWorkbook() {
  const aoa = [COLUMNS.map((c) => c.header), EXAMPLE_ROW];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = COLUMNS.map(() => ({ wch: 24 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Trainers');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(String(raw).replace(/[,\s]/g, ''));
  return Number.isFinite(num) ? num : null;
}

// Returns { rows: [{ rowNumber, data, error }], warning }. `data` holds
// raw parsed values; row-level validation errors (missing name, bad
// salary amount/type) are attached per-row as `error` rather than thrown,
// so one bad row doesn't block the rest of the file — the controller
// collects these into the same applied/skipped report every other bulk
// upload in the app uses. Email/duplicate checks happen in the
// controller, where DB access is available.
function parseTrainerBulkFile(filePath) {
  let workbook;
  try {
    workbook = XLSX.readFile(filePath, { raw: true, cellDates: true });
  } catch (err) {
    throw new Error('Could not read this file — please upload a valid CSV, XLS, or XLSX file.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], warning: 'The file has no sheets.' };

  const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
  const dataRows = raw.filter((r) => Array.isArray(r) && r.length > 0);
  if (dataRows.length === 0) return { rows: [], warning: 'The file is empty.' };

  const stripHint = (h) => normalizeHeader(String(h).replace(/\*/g, '').replace(/\([^)]*\)/g, '')).trim();
  const headerRow = dataRows[0].map(stripHint);
  const columnIndex = {};
  COLUMNS.forEach((col) => {
    const target = stripHint(col.header);
    columnIndex[col.key] = headerRow.findIndex((h) => h === target);
  });

  if (columnIndex.name === -1 || columnIndex.name === undefined) {
    return { rows: [], warning: 'Could not find a "Trainer Name" column. Please use the provided template.' };
  }

  const bodyRows = dataRows.slice(1);
  const rows = bodyRows
    .map((r, i) => {
      const get = (key) => {
        const idx = columnIndex[key];
        return idx === undefined || idx === -1 ? '' : r[idx];
      };
      const rowNumber = i + 2; // +1 for header row, +1 for 1-indexing
      const name = String(get('name') || '').trim();
      if (!name) return null; // skip fully-blank rows silently

      const salaryAmount = parseAmount(get('salary_amount'));
      const salaryTypeRaw = String(get('salary_type') || '').trim().toLowerCase();
      const salaryType = salaryTypeRaw || 'monthly';
      const email = String(get('email') || '').trim();

      let error = null;
      if (salaryAmount === null || salaryAmount < 0) {
        error = 'Salary Amount must be a positive number';
      } else if (!SALARY_TYPES.includes(salaryType)) {
        error = `Salary Type must be one of: ${SALARY_TYPES.join(', ')}`;
      } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error = 'Email is not a valid email address';
      }

      return {
        rowNumber,
        error,
        data: {
          name,
          email: email || null,
          phone: String(get('phone') || '').trim() || null,
          specialization: String(get('specialization') || '').trim() || null,
          qualification: String(get('qualification') || '').trim() || null,
          joining_date: parseDateValue(get('joining_date')),
          salary_type: salaryType,
          salary_amount: salaryAmount || 0,
          bank_account_number: String(get('bank_account_number') || '').trim() || null,
          ifsc_code: String(get('ifsc_code') || '').trim() || null,
          bank_name: String(get('bank_name') || '').trim() || null,
          bank_branch: String(get('bank_branch') || '').trim() || null,
        },
      };
    })
    .filter(Boolean);

  return { rows, warning: null };
}

module.exports = { buildTrainerTemplateWorkbook, parseTrainerBulkFile, SALARY_TYPES, COLUMNS };
