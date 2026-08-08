// Parses a "these payments went through" file for the bulk payment-
// reconciliation upload: either the institute's own NEFT/RTGS export
// (see src/utils/neftExport.js) re-uploaded after the bank appended a
// status column, or a generic bank statement / confirmation report with
// an account-number + amount (+ optional status) column somewhere.
const XLSX = require('xlsx');
const { parseAmount } = require('./bankStatementParser');

// The exact header row our own NEFT export writes — used to detect "this
// is our own file coming back" so we know to skip the 4 boilerplate rows
// beneath it (type codes, character limits, mandatory/optional, sample
// row) exactly the way neftExport.js lays them out, and to know the
// column positions are fixed (0=account, 2=amount) rather than needing
// header-based detection.
const OWN_TEMPLATE_HEADER = ['Beneficiary A/c no', 'Beneficiary Name', 'Instrument Amount', 'IFSC Code'];

const FAILURE_WORDS = ['fail', 'reject', 'return', 'bounce', 'declin', 'error', 'invalid'];
const SUCCESS_WORDS = ['success', 'paid', 'complete', 'processed', 'credited', 'done', 'ok'];

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function classifyStatusText(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return null;
  if (FAILURE_WORDS.some((w) => text.includes(w))) return 'failed';
  if (SUCCESS_WORDS.some((w) => text.includes(w))) return 'success';
  return null; // present but unrecognized — treated as "needs review" by the caller
}

function looksLikeOwnTemplate(headerRow) {
  const normalized = (headerRow || []).map(normalizeHeader);
  return OWN_TEMPLATE_HEADER.every((h, i) => normalized[i] === normalizeHeader(h));
}

const ACCOUNT_ALIASES = ['account no', 'a c no', 'account number', 'beneficiary account', 'acc no', 'bank account'];
const AMOUNT_ALIASES = ['amount', 'instrument amount', 'debit', 'debit amount', 'withdrawal', 'withdrawal amt'];
const STATUS_ALIASES = ['status', 'remark', 'remarks', 'result', 'response', 'utr status'];

function findColumn(headerRow, aliases) {
  const normalized = headerRow.map(normalizeHeader);
  return normalized.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
}

function parsePaymentConfirmationFile(filePath) {
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

  const isOwnTemplate = looksLikeOwnTemplate(dataRows[0]);
  let accountCol;
  let amountCol;
  let statusCol;
  let bodyRows;

  if (isOwnTemplate) {
    // Our own export: fixed columns, 4 boilerplate rows beneath the
    // header (indices 1-4), real data from index 5. Any column beyond 17
    // that a bank appended is scanned as a free-text status.
    accountCol = 0;
    amountCol = 2;
    bodyRows = dataRows.slice(5);
  } else {
    const headerRow = dataRows[0];
    accountCol = findColumn(headerRow, ACCOUNT_ALIASES);
    amountCol = findColumn(headerRow, AMOUNT_ALIASES);
    statusCol = findColumn(headerRow, STATUS_ALIASES);
    bodyRows = dataRows.slice(1);

    if (accountCol === -1 || amountCol === -1) {
      return { rows: [], warning: 'Could not find an account number and amount column. For a bank statement or confirmation report, make sure they\'re headed something like "Account No" and "Amount".' };
    }
  }

  const rows = bodyRows
    .map((r, i) => {
      const account = String(r[accountCol] || '').trim();
      const amount = parseAmount(r[amountCol]);
      if (!account || amount <= 0) return null; // skip blank/boilerplate rows silently

      let status = null;
      if (isOwnTemplate) {
        // Scan any trailing columns (beyond our own 18) for status text.
        const trailing = r.slice(18).join(' ');
        status = classifyStatusText(trailing);
      } else if (statusCol !== -1) {
        status = classifyStatusText(r[statusCol]);
      }

      return { rowNumber: i + (isOwnTemplate ? 6 : 2), accountNumber: account, amount, status };
    })
    .filter(Boolean);

  return { rows, warning: null };
}

module.exports = { parsePaymentConfirmationFile, classifyStatusText, looksLikeOwnTemplate };
