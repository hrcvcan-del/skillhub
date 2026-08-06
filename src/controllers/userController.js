const { User } = require('../models');
const { Op } = require('sequelize');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { ALL_ROLES } = require('../utils/roles');

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

function newForm(req, res) {
  res.render('users/form', { title: 'New user', user: {}, errors: null, roles: ALL_ROLES });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('users/form', { title: 'New user', user: req.body, errors, roles: ALL_ROLES });
  }

  const { name, email, password, role, phone } = req.body;
  const user = await User.create({ name, email, password_hash: password, role, phone });
  await logAction(req, { action: 'create', entityType: 'User', entityId: user.id, newValue: user.toJSON() });

  req.setFlash('success', 'User created.');
  res.redirect('/users');
}

async function editForm(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('users/form', { title: 'Edit user', user, errors: null, roles: ALL_ROLES });
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('users/form', {
      title: 'Edit user',
      user: { ...user.toJSON(), ...req.body },
      errors,
      roles: ALL_ROLES,
    });
  }

  const oldValue = user.toJSON();
  const { name, email, role, phone, is_active, password } = req.body;
  user.name = name;
  user.email = email;
  user.role = role;
  user.phone = phone;
  user.is_active = is_active === 'on' || is_active === 'true';
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
