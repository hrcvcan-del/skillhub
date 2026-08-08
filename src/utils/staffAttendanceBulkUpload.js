// Parses a bulk-upload Excel/CSV of staff clock in/out times — one row
// per (staff email, date), covering every data_entry_operator/
// center_coordinator (or any staff on this module) in one file, matching
// what a biometric attendance machine or a manual daily register export
// typically looks like.
const XLSX = require('xlsx');
const { parseDateValue } = require('./bankStatementParser');

const COLUMNS = [
  { key: 'email', header: 'Staff Email*', required: true },
  { key: 'date', header: 'Date (DD/MM/YYYY)*', required: true },
  { key: 'in_time', header: 'In Time (HH:MM)' },
  { key: 'out_time', header: 'Out Time (HH:MM)' },
];

const EXAMPLE_ROW = ['operator@skillhub.local', '01/08/2026', '09:30', '17:30'];

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripHint(h) {
  return normalizeHeader(String(h).replace(/\*/g, '').replace(/\([^)]*\)/g, ''));
}

function buildStaffAttendanceTemplateWorkbook() {
  const aoa = [COLUMNS.map((c) => c.header), EXAMPLE_ROW];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = COLUMNS.map(() => ({ wch: 26 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Handles every shape a "time" cell shows up as once run through
// XLSX.utils.sheet_to_json({ raw: true, cellDates: true }):
//  - a Date object (Excel formatted the cell as a time) — read the LOCAL
//    hour/minute SheetJS parsed, not UTC (cellDates gives local wall-clock
//    fields for time-only cells, unlike full dates which are UTC-based).
//  - a plain number (Excel's underlying fraction-of-a-day, e.g. 0.375 for
//    09:00, when the cell wasn't given a time format).
//  - a string like "09:30", "9:30 AM", "9.30".
function parseTimeValue(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${pad2(raw.getHours())}:${pad2(raw.getMinutes())}`;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }
  const str = String(raw || '').trim();
  if (!str) return null;

  let m = str.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3] ? m[3].toUpperCase() : null;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return `${pad2(h)}:${pad2(min)}`;
  }
  return null;
}

function parseStaffAttendanceBulkFile(filePath) {
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

  const headerRow = dataRows[0].map(stripHint);
  const columnIndex = {};
  COLUMNS.forEach((col) => {
    columnIndex[col.key] = headerRow.findIndex((h) => h === stripHint(col.header));
  });

  if (columnIndex.email === -1 || columnIndex.date === -1) {
    return { rows: [], warning: 'Could not find "Staff Email" and "Date" columns. Please use the provided template.' };
  }

  const bodyRows = dataRows.slice(1);
  const rows = bodyRows
    .map((r, i) => {
      const get = (key) => {
        const idx = columnIndex[key];
        return idx === undefined || idx === -1 ? '' : r[idx];
      };
      const email = String(get('email') || '').trim().toLowerCase();
      const dateRaw = get('date');
      if (!email && (dateRaw === '' || dateRaw === undefined)) return null; // skip fully-blank rows silently
      if (!email) return { rowNumber: i + 2, error: 'Missing Staff Email' };

      const date = parseDateValue(dateRaw);
      if (!date) return { rowNumber: i + 2, email, error: 'Missing or unreadable Date' };

      return {
        rowNumber: i + 2,
        email,
        date,
        inTime: parseTimeValue(get('in_time')),
        outTime: parseTimeValue(get('out_time')),
      };
    })
    .filter(Boolean);

  return { rows, warning: null };
}

module.exports = { buildStaffAttendanceTemplateWorkbook, parseStaffAttendanceBulkFile, parseTimeValue, COLUMNS };
