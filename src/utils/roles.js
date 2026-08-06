const ALL_ROLES = [
  'admin',
  'director',
  'manager',
  'scheme_manager',
  'center_coordinator',
  'mobilizer',
  'data_entry_operator',
  'verification_officer',
  'accountant',
  'staff',
  'trainer',
];

// Roles with full administrative privileges, equivalent to the original
// single 'admin' role. Kept as a named list so role checks throughout the
// app can grant 'director' the same access as 'admin' without repeating
// the pair everywhere.
const ADMIN_ROLES = ['admin', 'director'];

module.exports = { ALL_ROLES, ADMIN_ROLES };
