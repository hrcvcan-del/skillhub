const { Op } = require('sequelize');
const {
  BankTransactionAssignment,
  BankTransaction,
  BankAccount,
  TrainerSalaryPayment,
  Trainer,
  RentPayment,
  TrainingCenter,
  Director,
  TrainingPartnerBill,
  TrainingPartner,
  Expense,
  User,
} = require('../models');
const { buildAssignmentReportWorkbook } = require('../utils/assignmentReport');
const { buildPagination } = require('../utils/listQuery');
const { CATEGORIES: EXPENSE_CATEGORIES } = require('./expenseController');

const INCLUDES = [
  { model: BankTransaction, as: 'bankTransaction', include: [{ model: BankAccount, as: 'bankAccount' }] },
  { model: TrainerSalaryPayment, as: 'trainerSalaryPayment', include: [{ model: Trainer, as: 'trainer' }] },
  { model: RentPayment, as: 'rentPayment', include: [{ model: TrainingCenter, as: 'trainingCenter' }] },
  { model: Director, as: 'director' },
  { model: TrainingPartnerBill, as: 'trainingPartnerBill', include: [{ model: TrainingPartner, as: 'trainingPartner' }] },
  { model: Expense, as: 'expense' },
  { model: User, as: 'assignedByUser' },
];

// Builds the filter `where` shared by both the on-screen list and the
// Excel export, so what you see is exactly what you download.
function buildWhere(query) {
  const where = {};

  if (query.type === 'trainer_salary') {
    where.trainer_salary_payment_id = { [Op.ne]: null };
  } else if (query.type === 'rent') {
    where.rent_payment_id = { [Op.ne]: null };
  } else if (query.type === 'director') {
    where.director_id = { [Op.ne]: null };
    if (query.director_id) where.director_id = query.director_id;
  } else if (query.type === 'training_partner') {
    where.training_partner_bill_id = { [Op.ne]: null };
  } else if (query.type === 'expense') {
    where.expense_id = { [Op.ne]: null };
  }

  if (query.from || query.to) {
    where.assigned_at = {};
    if (query.from) where.assigned_at[Op.gte] = new Date(query.from);
    if (query.to) where.assigned_at[Op.lte] = new Date(`${query.to}T23:59:59`);
  }

  return where;
}

// Sub-filters that require a join condition on an included model rather
// than a plain column on the assignment itself.
function buildIncludes(query) {
  return INCLUDES.map((inc) => {
    if (inc.as === 'trainerSalaryPayment' && query.type === 'trainer_salary' && query.trainer_id) {
      return { ...inc, where: { trainer_id: query.trainer_id }, required: true };
    }
    if (inc.as === 'rentPayment' && query.type === 'rent' && query.center_id) {
      return { ...inc, where: { training_center_id: query.center_id }, required: true };
    }
    if (inc.as === 'trainingPartnerBill' && query.type === 'training_partner' && query.training_partner_id) {
      return { ...inc, where: { training_partner_id: query.training_partner_id }, required: true };
    }
    if (inc.as === 'expense' && query.type === 'expense' && query.expense_category) {
      return { ...inc, where: { category: query.expense_category }, required: true };
    }
    return inc;
  });
}

async function loadFilterOptions() {
  const [trainers, centers, directors, partners] = await Promise.all([
    Trainer.findAll({ order: [['name', 'ASC']] }),
    TrainingCenter.findAll({ order: [['name', 'ASC']] }),
    Director.findAll({ order: [['name', 'ASC']] }),
    TrainingPartner.findAll({ order: [['name', 'ASC']] }),
  ]);
  return { trainers, centers, directors, partners, expenseCategories: EXPENSE_CATEGORIES };
}

async function index(req, res) {
  const where = buildWhere(req.query);
  const include = buildIncludes(req.query);

  const total = await BankTransactionAssignment.count({ where, include, distinct: true });
  const pagination = buildPagination(req, total);
  const assignments = await BankTransactionAssignment.findAll({
    where,
    include,
    order: [['assigned_at', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const totalAmount = assignments.reduce((sum, a) => sum + Number(a.amount), 0);
  const options = await loadFilterOptions();

  res.render('assignmentReport/index', {
    title: 'Assigned Entries Report',
    assignments,
    totalAmount,
    ...options,
    filters: {
      type: req.query.type || '',
      trainer_id: req.query.trainer_id || '',
      center_id: req.query.center_id || '',
      director_id: req.query.director_id || '',
      training_partner_id: req.query.training_partner_id || '',
      expense_category: req.query.expense_category || '',
      from: req.query.from || '',
      to: req.query.to || '',
    },
    pagination,
  });
}

async function exportExcel(req, res) {
  const where = buildWhere(req.query);
  const include = buildIncludes(req.query);

  const assignments = await BankTransactionAssignment.findAll({ where, include, order: [['assigned_at', 'DESC']] });

  const buffer = buildAssignmentReportWorkbook(assignments);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Assigned-Entries-Report.xlsx"');
  res.send(buffer);
}

module.exports = { index, exportExcel };
