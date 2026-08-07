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
  'staff',
  'trainer',
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

module.exports = {
  ALL_ROLES,
  ADMIN_ROLES,
  FINANCE_ROLES,
  RENT_VIEW_ROLES,
  SALARY_UPDATE_ROLES,
  ELECTRICITY_ROLES,
  TRAINER_ADVANCE_ROLES,
};
