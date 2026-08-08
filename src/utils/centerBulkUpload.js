// Parses a bulk-upload Excel/CSV file of Training Centers (one row per
// center) and builds the downloadable blank template. Mirrors the header-
// detection-light, alias-free approach of the bank statement parser but is
// simpler: centers use a small fixed column set that we fully control via
// the template, so we match headers by normalized exact name rather than
// aliases.
const XLSX = require('xlsx');
const { parseDateValue } = require('./bankStatementParser');

const COLUMNS = [
  { key: 'name', header: 'Center Name*', required: true },
  { key: 'address', header: 'Address' },
  { key: 'city', header: 'City' },
  { key: 'district', header: 'District' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'capacity', header: 'Capacity' },
  { key: 'monthly_rent_amount', header: 'Monthly Rent Amount*', required: true },
  { key: 'landlord_name', header: 'Landlord Name' },
  { key: 'landlord_contact', header: 'Landlord Contact' },
  { key: 'lease_start_date', header: 'Lease Start Date (DD/MM/YYYY)' },
  { key: 'lease_end_date', header: 'Lease End Date (DD/MM/YYYY)' },
  { key: 'planned_closure_date', header: 'Planned Closure Date (DD/MM/YYYY)' },
  { key: 'scheme_phase', header: 'Scheme Phase (exact name, optional)' },
  { key: 'coordinator_email', header: 'Coordinator Email (optional)' },
  { key: 'owner_bank_account_number', header: 'Owner Bank Account Number' },
  { key: 'owner_upi_id', header: 'Owner UPI ID' },
];

const EXAMPLE_ROW = [
  'Downtown Skill Center',
  '12 MG Road',
  'Bengaluru',
  'Bengaluru Urban',
  '9876543210',
  'downtown@example.com',
  60,
  25000,
  'Ramesh Gowda',
  '9988776655',
  '01/04/2026',
  '31/03/2028',
  '',
  '',
  '',
  '',
  '',
];

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildCenterTemplateWorkbook() {
  const aoa = [COLUMNS.map((c) => c.header), EXAMPLE_ROW];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = COLUMNS.map(() => ({ wch: 24 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Centers');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(String(raw).replace(/[,\s]/g, ''));
  return Number.isFinite(num) ? num : null;
}

// Returns { rows: [{ rowNumber, data }], warning } where `data` has raw
// (unvalidated, un-looked-up) string/number values keyed by COLUMNS[].key.
// Validation and FK lookups happen in the controller, where DB access to
// resolve Scheme Phase / Coordinator is available.
function parseCenterBulkFile(filePath) {
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

  // The template's headers are fully under our control, so match by exact
  // normalized text (with the "*" required-marker and any parenthesized
  // hint like "(DD/MM/YYYY)" stripped first) rather than fuzzy matching —
  // that avoids ambiguity between short/overlapping names like "City" vs
  // "District". Both the file's actual headers and the template's target
  // headers go through the same strip-then-normalize step, or a hint like
  // "(DD/MM/YYYY)" would only ever be stripped from one side.
  const stripHint = (h) => normalizeHeader(String(h).replace(/\*/g, '').replace(/\([^)]*\)/g, '')).trim();
  const headerRow = dataRows[0].map(stripHint);
  const columnIndex = {};
  COLUMNS.forEach((col) => {
    const target = stripHint(col.header);
    columnIndex[col.key] = headerRow.findIndex((h) => h === target);
  });

  if (columnIndex.name === -1 || columnIndex.name === undefined) {
    return { rows: [], warning: 'Could not find a "Center Name" column. Please use the provided template.' };
  }

  const bodyRows = dataRows.slice(1);
  const rows = bodyRows
    .map((r, i) => {
      const get = (key) => {
        const idx = columnIndex[key];
        return idx === undefined || idx === -1 ? '' : r[idx];
      };
      const name = String(get('name') || '').trim();
      if (!name) return null; // skip fully-blank rows silently

      return {
        rowNumber: i + 2, // +1 for header row, +1 for 1-indexing
        data: {
          name,
          address: String(get('address') || '').trim() || null,
          city: String(get('city') || '').trim() || null,
          district: String(get('district') || '').trim() || null,
          phone: String(get('phone') || '').trim() || null,
          email: String(get('email') || '').trim() || null,
          capacity: parseAmount(get('capacity')),
          monthly_rent_amount: parseAmount(get('monthly_rent_amount')),
          landlord_name: String(get('landlord_name') || '').trim() || null,
          landlord_contact: String(get('landlord_contact') || '').trim() || null,
          lease_start_date: parseDateValue(get('lease_start_date')),
          lease_end_date: parseDateValue(get('lease_end_date')),
          planned_closure_date: parseDateValue(get('planned_closure_date')),
          scheme_phase_name: String(get('scheme_phase') || '').trim() || null,
          coordinator_email: String(get('coordinator_email') || '').trim() || null,
          owner_bank_account_number: String(get('owner_bank_account_number') || '').trim() || null,
          owner_upi_id: String(get('owner_upi_id') || '').trim() || null,
        },
      };
    })
    .filter(Boolean);

  return { rows, warning: null };
}

module.exports = { buildCenterTemplateWorkbook, parseCenterBulkFile, COLUMNS };
