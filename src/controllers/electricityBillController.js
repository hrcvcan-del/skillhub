// Electricity Bills is deliberately its own thin wrapper around the
// Expense model (not a copy of expenseController's full CRUD) — it's the
// one Expense category 'accountant' is allowed to see at all, so every
// query here is hard-scoped to category='utilities' regardless of what a
// request tries to pass in.
const { Op } = require('sequelize');
const { Expense, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

const CATEGORY = 'utilities';

async function index(req, res) {
  const where = { category: CATEGORY };
  if (req.query.center_id) where.training_center_id = req.query.center_id;
  if (req.query.from || req.query.to) {
    where.expense_date = {};
    if (req.query.from) where.expense_date[Op.gte] = req.query.from;
    if (req.query.to) where.expense_date[Op.lte] = req.query.to;
  }

  const total = await Expense.count({ where });
  const pagination = buildPagination(req, total);
  const bills = await Expense.findAll({
    where,
    include: [{ model: TrainingCenter, as: 'trainingCenter' }],
    order: [['expense_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  const totalAmount = (await Expense.sum('amount', { where })) || 0;
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });

  res.render('electricityBills/index', {
    title: 'Electricity Bills',
    bills,
    centers,
    totalAmount,
    filters: {
      center_id: req.query.center_id || '',
      from: req.query.from || '',
      to: req.query.to || '',
    },
    pagination,
  });
}

async function newForm(req, res) {
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  res.render('electricityBills/form', { title: 'New Electricity Bill', bill: {}, errors: null, centers });
}

async function create(req, res) {
  const errors = getErrors(req);
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  if (errors) {
    return res.status(422).render('electricityBills/form', { title: 'New Electricity Bill', bill: req.body, errors, centers });
  }

  const bill = await Expense.create({
    training_center_id: req.body.training_center_id || null,
    category: CATEGORY,
    description: req.body.description || 'Electricity bill',
    amount: req.body.amount,
    expense_date: req.body.expense_date,
    recorded_by: req.currentUser.id,
  });
  await logAction(req, { action: 'create', entityType: 'Expense', entityId: bill.id, newValue: bill.toJSON() });

  req.setFlash('success', 'Electricity bill recorded.');
  res.redirect('/electricity-bills');
}

module.exports = { index, newForm, create };
