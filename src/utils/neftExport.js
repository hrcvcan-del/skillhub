// Builds the bank NEFT/RTGS bulk-payment upload file for salary, matching
// the institute's real HDFC template exactly (rows extracted from a file
// the institute already uses successfully) — the bank's portal expects
// these first 5 rows (headers, field-type codes, character-length limits,
// mandatory/optional flags, and a sample/instruction row) verbatim, with
// real data starting at row 6. We hardcode them rather than reading the
// original file at runtime so this doesn't depend on a file living on
// anyone's machine.
const XLSX = require('xlsx');

const TEMPLATE_ROWS = [
  [
    'Beneficiary A/c no', 'Beneficiary Name', 'Instrument Amount', 'IFSC Code', 'Beneficiary email id',
    'Transaction Date', 'Transaction Type  NEFT/RTGS', 'Information to Beneficiary', 'Debit Acccount Narration',
    'Payment details 1', 'Payment details 2', 'Payment details 3', 'Payment details 4', 'Payment details 5',
    'Payment details 6', 'Payment details 7', 'Bene Bank Name', '',
  ],
  ['A', 'C', 'N', 'N', 'A', 'D', 'A', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'A', ''],
  [25, 40, '20 (17.2)', 15, 100, 10, 1, 20, 20, 30, 30, 30, 30, 30, 30, 30, 40, ''],
  [
    'Mandatory', 'Mandatory', 'Mandatory', 'Mandatory', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional',
    'Optional', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional', '',
  ],
  [
    '9999999999999', 'Beneficiary Name\nEnter data from Row 6, Do not delete first 6 rows ', '1500.00', 'HDFC0000240',
    'Email ids where the advice needs to be send for RBI payments', '28/01/2006', ' N for NEFT                R for RTGS',
    'Default first 20 character of Debit account', 'Default first 20 character of Beneficiary Name', 'Inv no 123',
    'Amt 111.00', '', '', '', '', '', ' State Bank OF India', '',
  ],
];

// trainers: array of { accountNumber, name, amount, ifscCode, email, bankName }
// — callers are responsible for filtering out trainers missing a mandatory
// field (account number / IFSC) before calling this.
function buildNeftWorkbook(trainers) {
  const aoa = TEMPLATE_ROWS.map((row) => [...row]);

  trainers.forEach((t) => {
    aoa.push([
      t.accountNumber,
      t.name,
      Number(t.amount),
      t.ifscCode,
      t.email || '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      t.bankName || '',
      '',
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'NEFT- RTGS');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
}

module.exports = { buildNeftWorkbook };
