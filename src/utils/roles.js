const ALL_ROLES = [
  'master_admin',
  'admin',
  'director',
  'finance_director',
  'accountant',
  'manager',
  'scheme_manager',
  'center_coordinator',
  'mobilizer',
  'data_entry_operator',
  'verification_officer',
  'hr',
  'staff',
  'trainer',
  'training_partner',
  'training_center',
  'center_manager',
];

// Roles with full administrative privileges, equivalent to the original
// single 'admin' role. Kept as a named list so role checks throughout the
// app can grant 'director' the same access as 'admin' without repeating
// the pair everywhere. NOTE: this does NOT include finance/expense access
// any more — see FINANCE_ROLES below. 'master_admin' is not listed here
// either; it bypasses every requireRole() check automatically (see
// src/middleware/roles.js) rather than being enumerated everywhere.
const ADMIN_ROLES = ['admin', 'director'];

// Full finance access (plus master_admin, which bypasses all checks) —
// Expenses, Rent Payments, Trainer Salaries, Bank Accounts/Statements/
// Suspense. 'accountant' is deliberately NOT in this list: it's a
// narrower role (see ACCOUNTANT_VIEW_ROLES/ACCOUNTANT_UPDATE_ROLES below)
// limited to viewing rent, updating salary, electricity-bill expenses, and
// trainer advances — no general Expenses, no Bank Accounts/Statements/
// Suspense.
const FINANCE_ROLES = ['finance_director'];

// Rent Payments: 'accountant' can only view status (paid/pending), not
// record/generate payments — that stays FINANCE_ROLES-only.
const RENT_VIEW_ROLES = [...FINANCE_ROLES, 'accountant'];

// Trainer Salary: 'accountant' can view AND mark payments (update), but
// not generate the month's dues — that stays FINANCE_ROLES-only.
const SALARY_UPDATE_ROLES = [...FINANCE_ROLES, 'accountant'];

// Electricity Bills (Expenses scoped to category='utilities') and Trainer
// Advances: 'accountant' gets full view+manage access, same as
// finance_director.
const ELECTRICITY_ROLES = [...FINANCE_ROLES, 'accountant'];
const TRAINER_ADVANCE_ROLES = [...FINANCE_ROLES, 'accountant'];

// Directors list (name-only ledger, not tied to logins) and the filtered
// "All Assigned Entries" report/export — finance_director/master_admin
// only, same tier as general Expenses/Bank Accounts.
const DIRECTOR_ROLES = [...FINANCE_ROLES];
const ASSIGNMENT_REPORT_ROLES = [...FINANCE_ROLES];

// Training Partners (vendor) management — creating/editing partner
// records and reviewing/approving their bills stays finance_director-only.
// The 'training_partner' role itself is scoped separately (a partner only
// ever sees their own record via req.currentUser.training_partner_id —
// see src/utils/trainingPartnerScope.js) and is never added here.
const TRAINING_PARTNER_MANAGE_ROLES = [...FINANCE_ROLES];

// Student Document Verification: who can open a batch's checklist and
// mark documents submitted/not-submitted after physically checking a
// student's file. 'data_entry_operator'/'verification_officer' are the
// two roles this exists for; admin/director/master_admin can also mark
// (covering for an operator, spot-checks) without needing a separate
// permission tier.
const DOCUMENT_VERIFY_ROLES = [...ADMIN_ROLES, 'data_entry_operator', 'verification_officer'];

// The two document reports — "which enrolled students are missing which
// documents" and "how much work did each operator do" — are oversight
// tools, not part of an operator's own job, so they're admin/director/
// master_admin only (same tier as Users management).
const DOCUMENT_REPORT_ROLES = [...ADMIN_ROLES];

// HR: daily trainer attendance marking + the monthly summary grid used to
// sanity-check it before running payroll.
const ATTENDANCE_ROLES = [...ADMIN_ROLES, 'hr'];

// Generating attendance-based salary + the NEFT/RTGS bank Excel is HR's
// job per the institute's workflow, but it writes into the same
// TrainerSalaryPayment rows finance_director/accountant already manage
// on /salary-payments — so both sides of that workflow can trigger it.
const PAYROLL_GENERATE_ROLES = [...new Set([...ATTENDANCE_ROLES, ...SALARY_UPDATE_ROLES])];

// Which login roles are paid via the hourly clock-in/out module (as
// opposed to Trainers, who use the daily present/absent module above).
// Restricting bulk-upload/mark-for-others matching to these roles stops a
// mistyped email in an Excel file from accidentally clocking in a
// director or trainer-role account.
const STAFF_TRACKED_ROLES = ['data_entry_operator', 'center_coordinator'];

// Same split as trainer attendance: HR/admin mark for others, upload the
// bulk Excel, and view the summary; payroll generation is also reachable
// by finance_director/accountant since it feeds their existing
// /salary-payments-style review. Self-service clock in/out (any staff
// marking their own day) needs no special role — see
// src/routes/staffAttendance.js.
const STAFF_ATTENDANCE_ROLES = [...ADMIN_ROLES, 'hr'];
const STAFF_PAYROLL_GENERATE_ROLES = [...new Set([...STAFF_ATTENDANCE_ROLES, ...SALARY_UPDATE_ROLES])];

// Mobilization: a Center Coordinator logs how many physical admission
// forms they received from a Trainer; admin/director/manager can also
// log an entry (e.g. on a coordinator's behalf). Reviewing — recording
// how many were actually accepted — is a Head Office job, one tier
// broader (adds scheme_manager, who tracks admissions against a scheme
// phase's target).
const MOBILIZATION_ENTRY_ROLES = [...ADMIN_ROLES, 'manager', 'center_coordinator'];
const MOBILIZATION_REVIEW_ROLES = [...ADMIN_ROLES, 'manager', 'scheme_manager'];

// Daily Admission Count: the mobilizer (head office) calls a trainer each
// day, before any physical form exists, and logs how many admissions
// they've done. 'mobilizer' is the dedicated role for this job.
const MOBILIZATION_DAILY_ROLES = [...ADMIN_ROLES, 'manager', 'mobilizer'];

// The reconciliation summary (daily-reported admissions vs forms
// submitted vs forms accepted) is useful to everyone with a hand in the
// pipeline — entry, daily-count, and review roles all get read access.
const MOBILIZATION_VIEW_ROLES = [
  ...new Set([...MOBILIZATION_ENTRY_ROLES, ...MOBILIZATION_REVIEW_ROLES, ...MOBILIZATION_DAILY_ROLES]),
];

// Center Manager (an "add-only" login: create a Training Center, Center
// Coordinator, Data Entry Operator, Trainer, or Mobilizer, then no list/view
// access to any of them — see src/controllers/centerManagerController.js and
// routes/{centers,users,trainers,batches,students}.js) may only ever assign
// one of these three roles when creating a User — never admin/finance/etc.
// "Add Trainer" goes through the separate Trainer model/routes, not here.
const CENTER_MANAGER_ASSIGNABLE_ROLES = ['center_coordinator', 'data_entry_operator', 'mobilizer'];

// Who can assign a batch's Data Entry Operator for admissions data entry
// (Batch.student_entry_operator_id) — a Center Coordinator can assign this
// for batches at their own center (enforced via getScopedCenterIds, not
// this list), same tier as who can create/edit a batch at all.
const STUDENT_ENTRY_ASSIGN_ROLES = [...ADMIN_ROLES, 'manager', 'center_coordinator'];

module.exports = {
  ALL_ROLES,
  STUDENT_ENTRY_ASSIGN_ROLES,
  ADMIN_ROLES,
  CENTER_MANAGER_ASSIGNABLE_ROLES,
  FINANCE_ROLES,
  RENT_VIEW_ROLES,
  SALARY_UPDATE_ROLES,
  ELECTRICITY_ROLES,
  TRAINER_ADVANCE_ROLES,
  DIRECTOR_ROLES,
  ASSIGNMENT_REPORT_ROLES,
  TRAINING_PARTNER_MANAGE_ROLES,
  DOCUMENT_VERIFY_ROLES,
  DOCUMENT_REPORT_ROLES,
  ATTENDANCE_ROLES,
  PAYROLL_GENERATE_ROLES,
  STAFF_TRACKED_ROLES,
  STAFF_ATTENDANCE_ROLES,
  STAFF_PAYROLL_GENERATE_ROLES,
  MOBILIZATION_ENTRY_ROLES,
  MOBILIZATION_REVIEW_ROLES,
  MOBILIZATION_DAILY_ROLES,
  MOBILIZATION_VIEW_ROLES,
};
