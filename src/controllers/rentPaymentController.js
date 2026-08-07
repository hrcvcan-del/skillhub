const { RentPayment, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { syncRentStatus } = require('../utils/rentStatus');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dueDateFor(month, year) {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

async function index(req, res) {
  const where = {};
  if (req.query.center_id) where.training_center_id = req.query.center_id;
  if (req.query.status) where.status = req.query.status;
  if (req.query.year) where.for_year = req.query.year;

  const total = await RentPayment.count({ where });
  const pagination = buildPagination(req, total);
  const rentPayments = await RentPayment.findAll({
    where,
    include: [{ model: TrainingCenter, as: 'trainingCenter' }],
    order: [['for_year', 'DESC'], ['for_month', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  await Promise.all(rentPayments.map(syncRentStatus));

  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });
  const now = new Date();

  res.render('rentPayments/index', {
    title: 'Center Rent Management',
    rentPayments,
    centers,
    monthNames: MONTH_NAMES,
    filters: {
      center_id: req.query.center_id || '',
      status: req.query.status || '',
      year: req.query.year || '',
    },
    currentMonth: now.getMonth() + 1,
    currentYear: now.getFullYear(),
    pagination,
  });
}

async function generateForMonth(req, res) {
  const errors = getErrors(req);
  if (errors) {
    req.setFlash('error', errors.map((e) => e.message).join(', '));
    return res.redirect('/rent-payments');
  }

  const month = parseInt(req.body.for_month, 10);
  const year = parseInt(req.body.for_year, 10);

  const centers = await TrainingCenter.findAll({ where: { is_active: true } });
  let created = 0;

  for (const center of centers) {
    const existing = await RentPayment.findOne({
      where: { training_center_id: center.id, for_month: month, for_year: year },
    });
    if (existing) continue;

    await RentPayment.create({
      training_center_id: center.id,
      for_month: month,
      for_year: year,
      amount_due: center.monthly_rent_amount,
      amount_paid: 0,
      due_date: dueDateFor(month, year),
      status: 'pending',
    });
    created += 1;
  }

  req.setFlash('success', `Generated ${created} rent record(s) for ${MONTH_NAMES[month - 1]} ${year}.`);
  res.redirect('/rent-payments');
}

async function newForm(req, res) {
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  res.render('rentPayments/form', { title: 'New Rent Record', rent: {}, errors: null, centers });
}

async function create(req, res) {
  const errors = getErrors(req);
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  if (errors) {
    return res.status(422).render('rentPayments/form', { title: 'New Rent Record', rent: req.body, errors, centers });
  }

  const rent = await RentPayment.create({
    training_center_id: req.body.training_center_id,
    for_month: req.body.for_month,
    for_year: req.body.for_year,
    amount_due: req.body.amount_due,
    amount_paid: 0,
    due_date: req.body.due_date,
    status: 'pending',
    notes: req.body.notes || null,
  });
  await logAction(req, { action: 'create', entityType: 'RentPayment', entityId: rent.id, newValue: rent.toJSON() });

  req.setFlash('success', 'Rent record created.');
  res.redirect('/rent-payments');
}

async function payForm(req, res) {
  const rent = await RentPayment.findByPk(req.params.id, { include: [{ model: TrainingCenter, as: 'trainingCenter' }] });
  if (!rent) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('rentPayments/pay', { title: 'Record Rent Payment', rent, errors: null });
}

async function pay(req, res) {
  const rent = await RentPayment.findByPk(req.params.id);
  if (!rent) return res.status(404).render('errors/404', { title: 'Not found' });

  const oldValue = rent.toJSON();
  const amountPaid = Number(rent.amount_paid) + Number(req.body.amount || 0);
  const isFullyPaid = amountPaid >= Number(rent.amount_due);

  await rent.update({
    amount_paid: amountPaid,
    payment_mode: req.body.payment_mode,
    paid_date: req.body.paid_date,
    status: isFullyPaid ? 'paid' : 'pending',
    recorded_by: req.currentUser.id,
    notes: req.body.notes || rent.notes,
  });
  await logAction(req, { action: 'pay', entityType: 'RentPayment', entityId: rent.id, oldValue, newValue: rent.toJSON() });

  req.setFlash('success', isFullyPaid ? 'Rent marked as paid.' : 'Partial rent payment recorded.');
  res.redirect('/rent-payments');
}

module.exports = { index, generateForMonth, newForm, create, payForm, pay, MONTH_NAMES };
