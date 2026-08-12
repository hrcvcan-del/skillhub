// Standard, quick-pick categories for a Center Coordinator / Data Entry
// Operator's daily work log (see src/models/workRemark.js). Kept as a flat
// list rather than an enum column so head office can add one later without
// a migration — "Other" always stays last so it never gets buried.
const WORK_REMARK_TYPES = [
  'Student Data Entry',
  'Document Verification',
  'Student Follow-up / Counselling',
  'Admission Form Collection',
  'Batch Coordination',
  'Center Visit',
  'Attendance Marking',
  'Meeting / Training',
  'Report Preparation',
  'Other',
];

module.exports = { WORK_REMARK_TYPES };
