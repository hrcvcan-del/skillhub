const { Op } = require('sequelize');
const { Expense, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { sendCsv } = require('../utils/csv');
const { getScopedCenterIds, centerIdsWhereValue, NO_MATCH_ID } = require('../utils/centerScope');

const CATEGORIES = ['utilities', 'marketing', 'maintenance', 'supplies', 'travel', 'salaries_admin', 'misc'];

function buildWhere(query, centerIds) {
  const where = {};
  if (query.center_id) {
    if (centerIds && !centerIds.includes(Number(query.center_id))) {
      where.training_center_id = NO_MATCH_ID;
    } else {
      where.training_center_id = query.center_id;
    }
  } else if (centerIds) {
    where.training_center_id = centerIdsWhereValue(centerIds);
  }
  if (query.category) where.category = query.category;
  if (query.from || query.to) {
    where.expense_date = {};
    if (query.from) where.expense_date[Op.gte] = query.from;
    if (query.to) where.expense_date[Op.lte] = query.to;
  }
  return where;
}

async function index(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const where = buildWhere(req.query, centerIds);

  const total = await Expense.count({ where });
  const pagination = buildPagination(req, total);
  const expenses = await Expense.findAll({
    where,
    include: [{ model: TrainingCenter, as: 'trainingCenter' }],
    order: [['expense_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const totalAmount = await Expense.sum('amount', { where });
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds) } : {};
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });

  res.render('expenses/index', {
    title: 'Expenses',
    expenses,
    centers,
    categories: CATEGORIES,
    filters: {
      center_id: req.query.center_id || '',
      category: req.query.category || '',
      from: req.query.from || '',
      to: req.query.to || '',
    },
    totalAmount: totalAmount || 0,
    pagination,
  });
}

async function exportCsv(req, res) {
  const where = buildWhere(req.query);
  const expenses = await Expense.findAll({
    where,
    include: [{ model: TrainingCenter, as: 'trainingCenter' }],
    order: [['expense_date', 'DESC']],
  });

  sendCsv(res, 'expenses.csv', expenses, [
    { label: 'Date', value: (e) => e.expense_date },
    { label: 'Center', value: (e) => (e.trainingCenter ? e.trainingCenter.name : 'Institute-wide') },
    { label: 'Category', value: (e) => e.category },
    { label: 'Description', value: (e) => e.description },
    { label: 'Amount', value: (e) => e.amount },
  ]);
}

async function newForm(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds), is_active: true } : { is_active: true };
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });
  res.render('expenses/form', {
    title: 'New Expense',
    expense: {},
    errors: null,
    centers,
    categories: CATEGORIES,
    scoped: !!centerIds,
  });
}

async function create(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const errors = getErrors(req);
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds), is_active: true } : { is_active: true };
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });
  const rerender = (formErrors) =>
    res.status(422).render('expenses/form', {
      title: 'New Expense',
      expense: req.body,
      errors: formErrors,
      centers,
      categories: CATEGORIES,
      scoped: !!centerIds,
    });

  if (errors) return rerender(errors);

  // A Center Coordinator always logs an expense against one of their own
  // centers — they can't leave it "Institute-wide" or pick someone else's.
  if (centerIds) {
    if (!req.body.training_center_id || !centerIds.includes(Number(req.body.training_center_id))) {
      return rerender([{ field: 'training_center_id', message: 'Please select your own center' }]);
    }
  }

  const expense = await Expense.create({
    training_center_id: req.body.training_center_id || null,
    category: req.body.category,
    description: req.body.description || null,
    amount: req.body.amount,
    expense_date: req.body.expense_date,
    receipt_file_url: req.file ? `/uploads/${req.file.filename}` : null,
    recorded_by: req.currentUser.id,
  });
  await logAction(req, { action: 'create', entityType: 'Expense', entityId: expense.id, newValue: expense.toJSON() });

  req.setFlash('success', 'Expense recorded.');
  res.redirect('/expenses');
}

async function editForm(req, res) {
  const expense = await Expense.findByPk(req.params.id);
  if (!expense) return res.status(404).render('errors/404', { title: 'Not found' });
  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && (!expense.training_center_id || !centerIds.includes(expense.training_center_id))) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds) } : {};
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });
  res.render('expenses/form', { title: 'Edit Expense', expense, errors: null, centers, categories: CATEGORIES, scoped: !!centerIds });
}

async function update(req, res) {
  const expense = await Expense.findByPk(req.params.id);
  if (!expense) return res.status(404).render('errors/404', { title: 'Not found' });

  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && (!expense.training_center_id || !centerIds.includes(expense.training_center_id))) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  const errors = getErrors(req);
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds) } : {};
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });
  if (centerIds && (!req.body.training_center_id || !centerIds.includes(Number(req.body.training_center_id)))) {
    return res.status(422).render('expenses/form', {
      title: 'Edit Expense',
      expense: { ...expense.toJSON(), ...req.body },
      errors: [{ field: 'training_center_id', message: 'Please select your own center' }],
      centers,
      categories: CATEGORIES,
      scoped: true,
    });
  }
  if (errors) {
    return res.status(422).render('expenses/form', {
      title: 'Edit Expense',
      expense: { ...expense.toJSON(), ...req.body },
      errors,
      centers,
      categories: CATEGORIES,
      scoped: !!centerIds,
    });
  }

  const oldValue = expense.toJSON();
  await expense.update({
    training_center_id: req.body.training_center_id || null,
    category: req.body.category,
    description: req.body.description || null,
    amount: req.body.amount,
    expense_date: req.body.expense_date,
    receipt_file_url: req.file ? `/uploads/${req.file.filename}` : expense.receipt_file_url,
  });
  await logAction(req, { action: 'update', entityType: 'Expense', entityId: expense.id, oldValue, newValue: expense.toJSON() });

  req.setFlash('success', 'Expense updated.');
  res.redirect('/expenses');
}

async function destroy(req, res) {
  const expense = await Expense.findByPk(req.params.id);
  if (!expense) return res.status(404).render('errors/404', { title: 'Not found' });

  await logAction(req, { action: 'delete', entityType: 'Expense', entityId: expense.id, oldValue: expense.toJSON() });
  await expense.destroy();

  req.setFlash('success', 'Expense deleted.');
  res.redirect('/expenses');
}

module.exports = { index, exportCsv, newForm, create, editForm, update, destroy, CATEGORIES };
