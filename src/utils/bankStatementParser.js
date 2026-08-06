const XLSX = require('xlsx');

const COLUMN_ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'posting date', 'value dt', 'tran date'],
  valueDate: ['value date', 'value dt'],
  narration: ['narration', 'description', 'particulars', 'transaction details', 'remarks', 'details', 'transaction remarks'],
  debit: ['debit', 'withdrawal', 'withdrawal amt', 'withdrawal amount', 'dr', 'debit amount', 'debit amt'],
  credit: ['credit', 'deposit', 'deposit amt', 'deposit amount', 'cr', 'credit amount', 'credit amt'],
  balance: ['balance', 'closing balance', 'available balance', 'running balance', 'balance amt'],
  reference: ['reference', 'ref no', 'ref no.', 'cheque no', 'chq no', 'chq/ref no', 'reference number', 'chq ref no'],
  utr: ['utr', 'utr no', 'utr number'],
};

const PAYMENT_MODE_KEYWORDS = [
  ['neft', 'neft'],
  ['rtgs', 'rtgs'],
  ['imps', 'imps'],
  ['upi', 'upi'],
  ['chq', 'cheque'],
  ['cheque', 'cheque'],
  ['cash', 'cash'],
  ['chg', 'bank_charges'],
  ['charge', 'bank_charges'],
  ['auto debit', 'auto_debit'],
  ['ecs', 'auto_debit'],
  ['mandate', 'auto_debit'],
];

const NARRATION_NOISE_WORDS = new Set([
  'neft', 'rtgs', 'imps', 'upi', 'to', 'from', 'dr', 'cr', 'txn', 'transfer', 'payment', 'chq', 'cheque',
]);

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchAlias(normalizedCell) {
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => normalizedCell === alias || normalizedCell.includes(alias))) {
      return field;
    }
  }
  return null;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const normalized = rows[i].map(normalizeHeader);
    const hasDate = normalized.some((c) => c === 'date' || c.includes('date'));
    const hasAmount = normalized.some((c) => matchAlias(c) === 'debit' || matchAlias(c) === 'credit');
    if (hasDate && hasAmount) {
      return i;
    }
  }
  return -1;
}

function mapColumns(headerRow) {
  const columnMap = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    const field = matchAlias(normalized);
    // Prefer 'date' over 'valueDate' for the primary date column unless already taken
    if (field === 'date' && columnMap.date === undefined) {
      columnMap.date = index;
    } else if (field && columnMap[field] === undefined) {
      columnMap[field] = index;
    }
  });
  return columnMap;
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').replace(/^-$/, '0');
  const value = parseFloat(cleaned);
  return Number.isNaN(value) ? 0 : Math.abs(value);
}

function formatDateParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function expandTwoDigitYear(y) {
  if (String(y).length > 2) return String(y);
  const n = Number(y);
  return (n <= 69 ? 2000 + n : 1900 + n).toString();
}

// Assumes DD/MM/YYYY (the standard convention on Indian bank statements),
// not the US MM/DD/YYYY convention. Dates are extracted via plain regex
// rather than the JS Date constructor wherever possible, since constructing
// a Date from a date-only string and reading it back via toISOString() shifts
// by a day whenever the server's local timezone is not UTC (e.g. IST).
function parseDateValue(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // SheetJS builds cellDates using UTC components.
    return formatDateParts(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  const str = String(raw || '').trim();
  if (!str) return null;

  // DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY
  let m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return formatDateParts(expandTwoDigitYear(y), mo, d);
  }
  // YYYY-MM-DD or YYYY/MM/DD
  m = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return formatDateParts(y, mo, d);
  }
  // DD MMM YYYY / DD MMM YY, e.g. "05 Aug 2026"
  m = str.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/);
  if (m) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = months.indexOf(m[2].toLowerCase().slice(0, 3));
    if (monthIndex !== -1) {
      return formatDateParts(expandTwoDigitYear(m[3]), monthIndex + 1, m[1]);
    }
  }

  // Last resort: let JS interpret it, but read back the LOCAL fields (not
  // toISOString(), which converts to UTC and can shift the date by a day).
  const fallback = new Date(str);
  if (!Number.isNaN(fallback.getTime())) {
    return formatDateParts(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
  }
  return null;
}

function guessPaymentMode(narration) {
  const lower = String(narration || '').toLowerCase();
  const found = PAYMENT_MODE_KEYWORDS.find(([keyword]) => lower.includes(keyword));
  return found ? found[1] : 'other';
}

function guessPartyName(narration) {
  const text = String(narration || '');
  const segments = text.split(/[/\-|]/).map((s) => s.trim()).filter(Boolean);

  let best = null;
  let bestScore = -1;
  segments.forEach((segment) => {
    const words = segment.toLowerCase().split(/\s+/);
    const isNoise = words.every((w) => NARRATION_NOISE_WORDS.has(w) || /^\d+$/.test(w));
    const looksLikeName = /[a-zA-Z]{3,}/.test(segment) && !isNoise;
    if (!looksLikeName) return;

    // Prefer segments without digits (more likely a party/company name than
    // a reference number or a date-ish fragment like "RENT JULY 2026").
    const hasDigits = /\d/.test(segment);
    const score = (hasDigits ? 0 : 100) + segment.length;
    if (score > bestScore) {
      bestScore = score;
      best = segment;
    }
  });

  return best ? best.slice(0, 100) : null;
}

function extractReference(narration) {
  const utrMatch = String(narration || '').match(/\b(\d{10,22})\b/);
  return utrMatch ? utrMatch[1] : null;
}

/**
 * Parses a CSV/XLS/XLSX bank statement file into a normalized array of
 * transaction rows. Auto-detects the header row and column meanings via
 * header-name heuristics rather than assuming a fixed bank-specific layout.
 */
function parseStatementFile(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true, cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // raw:true is important here — with raw:false, SheetJS silently
  // reinterprets date-shaped CSV strings using its own (US-style, 2-digit
  // year) formatting before we ever see them, corrupting DD/MM/YYYY dates.
  // With raw:true, CSV cells come through as the original text untouched.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: false });

  if (!rows.length) {
    return { transactions: [], warning: 'The file appears to be empty.' };
  }

  const headerIndex = findHeaderRow(rows);
  if (headerIndex === -1) {
    return { transactions: [], warning: 'Could not find a recognizable header row (date + debit/credit columns).' };
  }

  const columnMap = mapColumns(rows[headerIndex]);
  if (columnMap.date === undefined || (columnMap.debit === undefined && columnMap.credit === undefined)) {
    return { transactions: [], warning: 'Could not identify date/debit/credit columns in the header row.' };
  }

  const transactions = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell).trim() === '')) continue;

    const transactionDate = parseDateValue(row[columnMap.date]);
    if (!transactionDate) continue;

    const narration = columnMap.narration !== undefined ? String(row[columnMap.narration] || '').trim() : '';
    const debitAmount = columnMap.debit !== undefined ? parseAmount(row[columnMap.debit]) : 0;
    const creditAmount = columnMap.credit !== undefined ? parseAmount(row[columnMap.credit]) : 0;

    if (debitAmount === 0 && creditAmount === 0) continue;

    transactions.push({
      transaction_date: transactionDate,
      value_date: columnMap.valueDate !== undefined ? parseDateValue(row[columnMap.valueDate]) : transactionDate,
      narration,
      party_name: guessPartyName(narration),
      reference_number: columnMap.reference !== undefined ? String(row[columnMap.reference] || '').trim() || null : null,
      utr_number: columnMap.utr !== undefined ? String(row[columnMap.utr] || '').trim() || extractReference(narration) : extractReference(narration),
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      closing_balance: columnMap.balance !== undefined ? parseAmount(row[columnMap.balance]) : null,
      payment_mode: guessPaymentMode(narration),
    });
  }

  return { transactions, warning: null };
}

module.exports = { parseStatementFile, parseAmount, parseDateValue, guessPaymentMode, guessPartyName };
