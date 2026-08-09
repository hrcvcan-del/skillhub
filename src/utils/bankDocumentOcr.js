// Reads a photo of a bank passbook front page / cancelled cheque / bank
// statement and pulls out account holder name, account number, IFSC
// code, and branch details — using Tesseract.js (runs entirely on this
// server, no external API, no per-image cost). OCR on a photographed
// (not scanned) document is never perfect, especially on handwriting or
// a cheque's MICR line, so this is designed to PRE-FILL a form for a
// human to review, never to save data unattended.
const path = require('path');
const { createWorker } = require('tesseract.js');

// Tesseract downloads its language data once and caches it here so every
// subsequent scan reuses the cache instead of re-fetching from the CDN.
// Needs outbound internet the first time a scan runs on a fresh install.
const CACHE_PATH = path.join(__dirname, '..', '..', '.tesseract-cache');

// OCR very commonly reads the mandatory literal "0" in an IFSC's 5th
// position as the letter "O" (they're visually near-identical in most
// fonts) — accept either there, then normalize the match back to the
// real "0" every IFSC actually has, since that's the RBI-defined format.
const IFSC_PATTERN = /\b([A-Z]{4})[0O]([A-Z0-9]{6})\b/;

const KNOWN_BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank',
  'Bank of Baroda', 'Canara Bank', 'Union Bank of India', 'IDBI Bank', 'Kotak Mahindra Bank',
  'Yes Bank', 'IndusInd Bank', 'Bank of India', 'Central Bank of India', 'Indian Bank',
  'Indian Overseas Bank', 'UCO Bank', 'Bank of Maharashtra', 'Punjab & Sind Bank',
  'Federal Bank', 'South Indian Bank', 'Karnataka Bank', 'RBL Bank', 'IDFC FIRST Bank',
  'IDFC Bank', 'Bandhan Bank', 'City Union Bank', 'DCB Bank', 'Karur Vysya Bank',
  'Tamilnad Mercantile Bank', 'Jammu and Kashmir Bank', 'Dhanlaxmi Bank',
];

// Falls back to a bank's short-form/logo text (SBI, HDFC, PNB...) when the
// spelled-out name wasn't picked up by OCR — matched as a whole word only,
// so it doesn't fire on an unrelated 3-4 letter run elsewhere in the text.
const BANK_ABBREVIATIONS = {
  SBI: 'State Bank of India',
  PNB: 'Punjab National Bank',
  BOB: 'Bank of Baroda',
  BOI: 'Bank of India',
  IOB: 'Indian Overseas Bank',
  HDFC: 'HDFC Bank',
  ICICI: 'ICICI Bank',
  IDBI: 'IDBI Bank',
  UCO: 'UCO Bank',
};

// Labels that mean "the digits on this line are NOT the account number"
// — used to keep the no-label fallback (below) from grabbing a CIF
// number, MICR code, phone number, PAN, or PPO number instead. Real
// examples this guards against: a passbook's "CIF Number" and "Account
// No." are frequently the same digit-length, so the fallback needs to
// actively avoid the former, not just prefer the longest run.
const NON_ACCOUNT_LABELS = /\b(cif|micr|phone|mobile|pan|ppo|ifsc|code|reg\s*no)\b/i;

function findIfscCode(text) {
  const match = text.toUpperCase().match(IFSC_PATTERN);
  if (!match) return null;
  return `${match[1]}0${match[2]}`;
}

function findBankName(text) {
  const normalized = text.replace(/\s+/g, ' ');
  let earliest = null;
  for (const bank of KNOWN_BANKS) {
    const idx = normalized.toLowerCase().indexOf(bank.toLowerCase());
    if (idx !== -1 && (earliest === null || idx < earliest.idx)) {
      earliest = { idx, bank };
    }
  }
  if (earliest) return earliest.bank;

  for (const [abbr, fullName] of Object.entries(BANK_ABBREVIATIONS)) {
    if (new RegExp(`\\b${abbr}\\b`).test(normalized.toUpperCase())) {
      return fullName;
    }
  }
  return null;
}

// Branch name/address + branch code, e.g. "Branch: I.E.CHIKALTHANA
// AURANGABAD  Code: 20316" — kept as one combined field rather than a
// separately-parsed code, since the branch name alone is what most forms
// actually need and the code (when present) is useful context alongside it.
function findBranchDetails(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/branch\s*(?:name)?\s*[:\-]?\s*(.+)/i);
    if (!m) continue; // eslint-disable-line no-continue
    const cleaned = m[1].trim().replace(/^[:\-\s]+/, '');
    if (cleaned.length >= 2 && cleaned.length <= 100) return cleaned;
  }
  return null;
}

function findAccountNumber(text) {
  // Prefer a number that's explicitly labeled as an account number — the
  // digit group is deliberately restricted to spaces/tabs, NOT \s, since
  // \s also matches newlines: without this, a line-wrapped number would
  // happily keep matching straight into the next line's leading digits
  // (e.g. OCR noise below the real number), silently appending them.
  const labeled = text.match(/(?:a\/?c\.?|account)[^\S\r\n]*(?:no\.?|number)?[^\S\r\n]*[:\-]?[^\S\r\n]*(\d[\d \t]{7,19}\d)/i);
  if (labeled) return labeled[1].replace(/[ \t]+/g, '');

  // ...otherwise fall back to the longest plausible-length digit run
  // (account numbers are typically 9-18 digits) found on a line that
  // ISN'T labeled as something else (CIF/MICR/phone/PAN/...), so a
  // same-length CIF or MICR number sitting right next to the real
  // account number doesn't win just for being scanned first.
  let best = '';
  for (const line of text.split(/\r?\n/)) {
    if (NON_ACCOUNT_LABELS.test(line)) continue; // eslint-disable-line no-continue
    const runs = line.match(/\d{9,18}/g);
    if (!runs) continue; // eslint-disable-line no-continue
    for (const run of runs) {
      if (run.length > best.length) best = run;
    }
  }
  return best || null;
}

function findAccountHolderName(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/(?:account\s*holder\s*name|a\/?c\s*holder\s*name|a\/?c\s*holder|account\s*name|customer\s*name|beneficiary\s*name|^name)\s*[:\-]\s*(.+)/i);
    if (m) {
      // Skip if this "name" line is actually labeling the bank/branch.
      if (/bank|branch/i.test(m[0].split(':')[0])) continue; // eslint-disable-line no-continue
      const cleaned = m[1].trim().replace(/[^A-Za-z .]+$/, '').trim();
      if (cleaned.length >= 3 && cleaned.length <= 60) return cleaned;
    }
  }
  return null;
}

async function scanBankDocument(imagePath) {
  const worker = await createWorker('eng', 1, { cachePath: CACHE_PATH });
  try {
    const { data } = await worker.recognize(imagePath);
    const text = data.text || '';

    return {
      name: findAccountHolderName(text),
      accountNumber: findAccountNumber(text),
      ifscCode: findIfscCode(text),
      bankName: findBankName(text),
      branchDetails: findBranchDetails(text),
      rawText: text.trim(),
      confidence: Math.round(data.confidence || 0),
    };
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  scanBankDocument,
  findIfscCode,
  findBankName,
  findBranchDetails,
  findAccountNumber,
  findAccountHolderName,
};
