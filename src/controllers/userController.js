const { User, TrainingPartner } = require('../models');
const { Op } = require('sequelize');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { ALL_ROLES, CENTER_MANAGER_ASSIGNABLE_ROLES } = require('../utils/roles');

async function loadTrainingPartners() {
  return TrainingPartner.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
}

// req.files comes from multer's .fields() — undefined entirely if no files
// were attached to this submission at all.
function uploadedFileUrl(req, fieldName) {
  const file = req.files && req.files[fieldName] && req.files[fieldName][0];
  return file ? `/uploads/${file.filename}` : null;
}

async function index(req, res) {
  const search = req.query.q || '';
  const where = search
    ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }] }
    : {};

  const total = await User.count({ where });
  const pagination = buildPagination(req, total);
  const users = await User.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('users/index', { title: 'Users', users, search, pagination });
}

async function newForm(req, res) {
  const trainingPartners = await loadTrainingPartners();
  // center_manager is add-only and may only ever create a Center
  // Coordinator, Data Entry Operator, or Mobilizer — never admin/finance/
  // etc. Filtering the dropdown here is a UX convenience; create() below
  // re-checks server-side regardless, same "filtered dropdown + explicit
  // server-side re-validation" pattern used elsewhere in the app.
  const isCenterManager = req.currentUser.role === 'center_manager';
  const availableRoles = isCenterManager ? CENTER_MANAGER_ASSIGNABLE_ROLES : ALL_ROLES;
  // Supports quick-add links from other pages (e.g. Trainers ->
  // "Add Center Coordinator" / "Add Data Entry Operator") that pre-select
  // a role via ?role=... — validated against the roles this user is
  // actually allowed to assign, so an arbitrary query value can't end up
  // selected in a role that doesn't exist or one center_manager can't grant.
  const presetRole = availableRoles.includes(req.query.role)
    ? req.query.role
    : (isCenterManager ? CENTER_MANAGER_ASSIGNABLE_ROLES[0] : undefined);
  res.render('users/form', { title: 'New user', user: { role: presetRole }, errors: null, roles: availableRoles, trainingPartners });
}

async function create(req, res) {
  const trainingPartners = await loadTrainingPartners();
  const isCenterManager = req.currentUser.role === 'center_manager';
  const availableRoles = isCenterManager ? CENTER_MANAGER_ASSIGNABLE_ROLES : ALL_ROLES;

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('users/form', { title: 'New user', user: req.body, errors, roles: availableRoles, trainingPartners });
  }

  // Defense in depth: the role dropdown is already filtered for
  // center_manager (see newForm above), but the actual submitted value
  // must be re-checked here regardless — a filtered <select> alone doesn't
  // stop a crafted request from asking for role=admin.
  if (isCenterManager && !CENTER_MANAGER_ASSIGNABLE_ROLES.includes(req.body.role)) {
    return res.status(422).render('users/form', {
      title: 'New user',
      user: req.body,
      errors: [{ field: 'role', message: 'You can only add a Center Coordinator, Data Entry Operator, or Mobilizer account.' }],
      roles: availableRoles,
      trainingPartners,
    });
  }

  const { name, email, password, role, phone } = req.body;
  const user = await User.create({
    name,
    email,
    password_hash: password,
    role,
    phone,
    training_partner_id: role === 'training_partner' ? req.body.training_partner_id || null : null,
    salary_amount: req.body.salary_amount || null,
    bank_account_number: req.body.bank_account_number || null,
    ifsc_code: req.body.ifsc_code || null,
    bank_name: req.body.bank_name || null,
    bank_branch: req.body.bank_branch || null,
    aadhar_card_url: uploadedFileUrl(req, 'aadhar_card'),
    education_certificate_url: uploadedFileUrl(req, 'education_certificate'),
  });
  await logAction(req, { action: 'create', entityType: 'User', entityId: user.id, newValue: user.toJSON() });

  // center_manager is add-only and can't view /users — land them on a
  // plain confirmation instead of a page they'd immediately be blocked from.
  if (isCenterManager) {
    const roleLabels = {
      center_coordinator: 'Center Coordinator',
      data_entry_operator: 'Data Entry Operator',
      mobilizer: 'Mobilizer',
    };
    return res.render('centerManager/added', {
      title: 'User Added',
      addedName: user.name,
      addedTypeLabel: roleLabels[user.role] || 'User',
      addAnotherUrl: `/users/new?role=${user.role}`,
    });
  }

  req.setFlash('success', 'User created.');
  res.redirect('/users');
}

async function editForm(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).render('errors/404', { title: 'Not found' });
  const trainingPartners = await loadTrainingPartners();
  res.render('users/form', { title: 'Edit user', user, errors: null, roles: ALL_ROLES, trainingPartners });
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).render('errors/404', { title: 'Not found' });

  const trainingPartners = await loadTrainingPartners();
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('users/form', {
      title: 'Edit user',
      user: { ...user.toJSON(), ...req.body },
      errors,
      roles: ALL_ROLES,
      trainingPartners,
    });
  }

  const oldValue = user.toJSON();
  const { name, email, role, phone, is_active, password } = req.body;
  user.name = name;
  user.email = email;
  user.role = role;
  user.phone = phone;
  user.is_active = is_active === 'on' || is_active === 'true';
  user.training_partner_id = role === 'training_partner' ? req.body.training_partner_id || null : null;
  user.salary_amount = req.body.salary_amount || null;
  user.bank_account_number = req.body.bank_account_number || null;
  user.ifsc_code = req.body.ifsc_code || null;
  user.bank_name = req.body.bank_name || null;
  user.bank_branch = req.body.bank_branch || null;
  user.aadhar_card_url = uploadedFileUrl(req, 'aadhar_card') || user.aadhar_card_url;
  user.education_certificate_url = uploadedFileUrl(req, 'education_certificate') || user.education_certificate_url;
  if (password) {
    user.password_hash = password;
  }
  await user.save();
  await logAction(req, { action: 'update', entityType: 'User', entityId: user.id, oldValue, newValue: user.toJSON() });

  req.setFlash('success', 'User updated.');
  res.redirect('/users');
}

async function destroy(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).render('errors/404', { title: 'Not found' });

  if (user.id === req.currentUser.id) {
    req.setFlash('error', 'You cannot delete your own account.');
    return res.redirect('/users');
  }

  await logAction(req, { action: 'delete', entityType: 'User', entityId: user.id, oldValue: user.toJSON() });
  await user.destroy();

  req.setFlash('success', 'User deleted.');
  res.redirect('/users');
}

module.exports = { index, newForm, create, editForm, update, destroy };
