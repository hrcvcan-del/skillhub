const ALL_ROLES = [
  'master_admin',
  'admin',
  'director',
  'finance_director',
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

// Only these roles (plus master_admin, which bypasses all checks) can see
// or manage Finance/Expenses — Rent Payments, Trainer Salaries, Bank
// Accounts/Statements/Suspense, and Expenses itself. Replaces the old
// 'accountant' role, which every finance route/nav item now maps to.
const FINANCE_ROLES = ['finance_director'];

module.exports = { ALL_ROLES, ADMIN_ROLES, FINANCE_ROLES };
