// The 5 mandatory physical documents a Data Entry Operator checks against
// a student's file and marks submitted/not-submitted. Single source of
// truth for the migration's ENUM, the model, the checklist form, and both
// reports — add a 6th document here and nowhere else needs to change
// except a migration to widen the ENUM.
const DOCUMENT_TYPES = [
  { key: 'aadhaar', label: 'Aadhar Card' },
  { key: 'caste_certificate', label: 'Caste Certificate' },
  { key: 'leaving_certificate_marksheet', label: 'Leaving Certificate / Marksheet' },
  { key: 'income_certificate_non_creamy_layer', label: 'Income Certificate / Non-Creamy Layer' },
  { key: 'photo', label: 'Photo' },
  { key: 'feedback_form', label: 'Feedback Form' },
];

const DOCUMENT_TYPE_KEYS = DOCUMENT_TYPES.map((d) => d.key);

function documentLabel(key) {
  const found = DOCUMENT_TYPES.find((d) => d.key === key);
  return found ? found.label : key;
}

module.exports = { DOCUMENT_TYPES, DOCUMENT_TYPE_KEYS, documentLabel };
