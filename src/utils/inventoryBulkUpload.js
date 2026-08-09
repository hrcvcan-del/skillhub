// Parses a bulk-upload Excel/CSV file of Equipment Inventory rows (one row
// per item) for a SINGLE training center chosen on the upload page itself
// — the file has no center column, since "select the center, then upload
// its equipment list" is the whole point of the flow. Mirrors the
// header-matching approach of centerBulkUpload.js: the template's headers
// are fully under our control, so match by normalized exact text rather
// than fuzzy aliases.
const XLSX = require('xlsx');
const { parseDateValue } = require('./bankStatementParser');

const CONDITIONS = ['new', 'good', 'needs_repair', 'damaged', 'disposed'];

const COLUMNS = [
  { key: 'name', header: 'Equipment Name*', required: true },
  { key: 'category', header: 'Category' },
  { key: 'quantity', header: 'Quantity*', required: true },
  { key: 'unit_purchase_cost', header: 'Unit Purchase Cost' },
  { key: 'purchase_date', header: 'Purchase Date (DD/MM/YYYY)' },
  { key: 'vendor_name', header: 'Vendor Name' },
  { key: 'condition', header: 'Condition (new/good/needs_repair/damaged/disposed)' },
  { key: 'warranty_expiry_date', header: 'Warranty Expiry Date (DD/MM/YYYY)' },
  { key: 'serial_number', header: 'Serial Number' },
  { key: 'notes', header: 'Notes' },
];

const EXAMPLE_ROW = ['Laptop', 'IT Equipment', 10, 45000, '01/04/2026', 'Acme Traders', 'new', '01/04/2029', '', ''];

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildInventoryTemplateWorkbook() {
  const aoa = [COLUMNS.map((c) => c.header), EXAMPLE_ROW];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = COLUMNS.map(() => ({ wch: 26 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Equipment');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(String(raw).replace(/[,\s]/g, ''));
  return Number.isFinite(num) ? num : null;
}

// Returns { rows: [{ rowNumber, data, error }], warning }. `data` holds
// raw parsed values; row-level validation errors (missing name, bad
// quantity/condition) are attached per-row as `error` rather than thrown,
// so one bad row doesn't block the rest of the file — the controller
// collects these into the same applied/skipped report every other bulk
// upload in the app uses.
function parseInventoryBulkFile(filePath) {
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
    return { rows: [], warning: 'Could not find an "Equipment Name" column. Please use the provided template.' };
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

      const quantityRaw = get('quantity');
      const quantity = parseAmount(quantityRaw);
      const conditionRaw = String(get('condition') || '').trim().toLowerCase();
      const condition = conditionRaw || 'new';

      let error = null;
      if (quantity === null || quantity < 1) {
        error = 'Quantity must be a positive number';
      } else if (!CONDITIONS.includes(condition)) {
        error = `Condition must be one of: ${CONDITIONS.join(', ')}`;
      }

      return {
        rowNumber,
        error,
        data: {
          name,
          category: String(get('category') || '').trim() || null,
          quantity: quantity || 1,
          unit_purchase_cost: parseAmount(get('unit_purchase_cost')) || 0,
          purchase_date: parseDateValue(get('purchase_date')),
          vendor_name: String(get('vendor_name') || '').trim() || null,
          condition,
          warranty_expiry_date: parseDateValue(get('warranty_expiry_date')),
          serial_number: String(get('serial_number') || '').trim() || null,
          notes: String(get('notes') || '').trim() || null,
        },
      };
    })
    .filter(Boolean);

  return { rows, warning: null };
}

module.exports = { buildInventoryTemplateWorkbook, parseInventoryBulkFile, CONDITIONS, COLUMNS };
