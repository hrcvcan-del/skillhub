const { Op } = require('sequelize');
const { Expense, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { sendCsv } = require('../utils/csv');

const CATEGORIES = ['utilities', 'marketing', 'maintenance', 'supplies', 'travel', 'salaries_admin', 'misc'];

function buildWhere(query) {
  const where = {};
  if (query.center_id) where.training_center_id = query.center_id;
  if (query.category) where.category = query.category;
  if (query.from || query.to) {
    where.expense_date = {};
    if (query.from) where.expense_date[Op.gte] = query.from;
    if (query.to) where.expense_date[Op.lte] = query.to;
  }
  return where;
}

async function index(req, res) {
  const where = buildWhere(req.query);

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
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });

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
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  res.render('expenses/form', { title: 'New Expense', expense: {}, errors: null, centers, categories: CATEGORIES });
}

async function create(req, res) {
  const errors = getErrors(req);
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  if (errors) {
    return res.status(422).render('expenses/form', { title: 'New Expense', expense: req.body, errors, centers, categories: CATEGORIES });
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
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });
  res.render('expenses/form', { title: 'Edit Expense', expense, errors: null, centers, categories: CATEGORIES });
}

async function update(req, res) {
  const expense = await Expense.findByPk(req.params.id);
  if (!expense) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });
  if (errors) {
    return res.status(422).render('expenses/form', {
      title: 'Edit Expense',
      expense: { ...expense.toJSON(), ...req.body },
      errors,
      centers,
      categories: CATEGORIES,
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
