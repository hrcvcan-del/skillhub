// Lightweight, keyword-based category suggestion for display purposes only
// (the Suspense register's "Suggested Category" column). This is a simple
// heuristic, not the full smart-matching/learning engine described in the
// spec — that (remembering previous party->category assignments, fuzzy
// matching against trainers/vendors/rent records) is a later phase.
const RULES = [
  [/salary|\bsal\b/i, 'Trainer Salary'],
  [/\brent\b/i, 'Centre Rent'],
  [/electric/i, 'Electricity Bill'],
  [/internet|broadband/i, 'Internet Bill'],
  [/water bill/i, 'Water Bill'],
  [/travel|fuel|petrol|diesel/i, 'Travel'],
  [/stationery|printing/i, 'Printing & Stationery'],
  [/bank chg|bank charge/i, 'Bank Charges'],
  [/vendor|invoice/i, 'Vendor Payment'],
];

function suggestCategory(transaction) {
  const text = `${transaction.narration || ''} ${transaction.party_name || ''}`;
  const match = RULES.find(([pattern]) => pattern.test(text));
  return match ? match[1] : null;
}

module.exports = { suggestCategory };
