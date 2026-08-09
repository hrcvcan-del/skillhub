// Reads a photo of a bank passbook front page / cancelled cheque / bank
// statement and pulls out name, account number, IFSC code, and bank name
// — using Tesseract.js (runs entirely on this server, no external API,
// no per-image cost). OCR on a photographed (not scanned) document is
// never perfect, especially on handwriting or a cheque's MICR line, so
// this is designed to PRE-FILL a form for a human to review, never to
// save data unattended.
const path = require('path');
const { createWorker } = require('tesseract.js');

// Tesseract downloads its language data once and caches it here so every
// subsequent scan reuses the cache instead of re-fetching from the CDN.
// Needs outbound internet the first time a scan runs on a fresh install.
const CACHE_PATH = path.join(__dirname, '..', '..', '.tesseract-cache');

const IFSC_PATTERN = /\b[A-Z]{4}0[A-Z0-9]{6}\b/;

const KNOWN_BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank',
  'Bank of Baroda', 'Canara Bank', 'Union Bank of India', 'IDBI Bank', 'Kotak Mahindra Bank',
  'Yes Bank', 'IndusInd Bank', 'Bank of India', 'Central Bank of India', 'Indian Bank',
  'Indian Overseas Bank', 'UCO Bank', 'Bank of Maharashtra', 'Punjab & Sind Bank',
  'Federal Bank', 'South Indian Bank', 'Karnataka Bank', 'RBL Bank', 'IDFC FIRST Bank',
  'IDFC Bank', 'Bandhan Bank', 'City Union Bank', 'DCB Bank', 'Karur Vysya Bank',
  'Tamilnad Mercantile Bank', 'Jammu and Kashmir Bank', 'Dhanlaxmi Bank',
];

function findIfscCode(text) {
  const match = text.toUpperCase().match(IFSC_PATTERN);
  return match ? match[0] : null;
}

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

function findAccountNumber(text) {
  // Prefer a number that's explicitly labeled as an account number...
  const labeled = text.match(/(?:a\/?c\.?|account)\s*(?:no\.?|number)?\s*[:\-]?\s*(\d[\d\s]{7,19}\d)/i);
  if (labeled) return labeled[1].replace(/\s+/g, '');

  // ...otherwise fall back to the longest plausible-length digit run
  // anywhere in the text (account numbers are typically 9-18 digits;
  // this deliberately avoids matching a shorter IFSC-adjacent number or a
  // phone number).
  const allRuns = text.match(/\d{9,18}/g);
  if (!allRuns) return null;
  return allRuns.reduce((longest, run) => (run.length > longest.length ? run : longest), '');
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
      rawText: text.trim(),
      confidence: Math.round(data.confidence || 0),
    };
  } finally {
    await worker.terminate();
  }
}

module.exports = { scanBankDocument, findIfscCode, findBankName, findAccountNumber, findAccountHolderName };
