const { TrainerSalaryPayment, Trainer, TrainingCenter, Batch, TrainerAdvance } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function index(req, res) {
  const where = {};
  if (req.query.trainer_id) where.trainer_id = req.query.trainer_id;
  if (req.query.status) where.status = req.query.status;
  if (req.query.year) where.for_year = req.query.year;

  const total = await TrainerSalaryPayment.count({ where });
  const pagination = buildPagination(req, total);
  const salaryPayments = await TrainerSalaryPayment.findAll({
    where,
    include: [{ model: Trainer, as: 'trainer' }, { model: TrainingCenter, as: 'trainingCenter' }],
    order: [['for_year', 'DESC'], ['for_month', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const trainers = await Trainer.findAll({ order: [['name', 'ASC']] });
  const now = new Date();

  res.render('salaryPayments/index', {
    title: 'Trainer Salary Management',
    salaryPayments,
    trainers,
    monthNames: MONTH_NAMES,
    filters: {
      trainer_id: req.query.trainer_id || '',
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
    return res.redirect('/salary-payments');
  }

  const month = parseInt(req.body.for_month, 10);
  const year = parseInt(req.body.for_year, 10);

  const trainers = await Trainer.findAll({ where: { is_active: true } });
  let created = 0;
  let advancesApplied = 0;

  for (const trainer of trainers) {
    const existing = await TrainerSalaryPayment.findOne({
      where: { trainer_id: trainer.id, for_month: month, for_year: year },
    });
    if (existing) continue;

    const centerIds = (await Batch.findAll({ where: { trainer_id: trainer.id }, attributes: ['training_center_id'] }))
      .map((b) => b.training_center_id);
    const uniqueCenterIds = [...new Set(centerIds)];
    const training_center_id = uniqueCenterIds.length === 1 ? uniqueCenterIds[0] : null;

    // Auto-deduct any unapplied advances given to this trainer since the
    // last generated due — see src/controllers/trainerAdvanceController.js.
    const pendingAdvances = await TrainerAdvance.findAll({
      where: { trainer_id: trainer.id, status: 'pending' },
    });
    const advanceTotal = pendingAdvances.reduce((sum, a) => sum + Number(a.amount), 0);

    const salaryPayment = await TrainerSalaryPayment.create({
      trainer_id: trainer.id,
      training_center_id,
      for_month: month,
      for_year: year,
      amount: trainer.salary_amount,
      bonus_amount: 0,
      deduction_amount: advanceTotal,
      status: 'pending',
    });

    if (pendingAdvances.length > 0) {
      await TrainerAdvance.update(
        { status: 'deducted', deducted_in_salary_payment_id: salaryPayment.id },
        { where: { id: pendingAdvances.map((a) => a.id) } }
      );
      advancesApplied += pendingAdvances.length;
    }

    created += 1;
  }

  req.setFlash(
    'success',
    `Generated ${created} salary due(s) for ${MONTH_NAMES[month - 1]} ${year}` +
      (advancesApplied > 0 ? `, auto-deducting ${advancesApplied} pending advance(s).` : '.')
  );
  res.redirect('/salary-payments');
}

async function payForm(req, res) {
  const salaryPayment = await TrainerSalaryPayment.findByPk(req.params.id, {
    include: [{ model: Trainer, as: 'trainer' }],
  });
  if (!salaryPayment) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('salaryPayments/pay', { title: 'Record Salary Payment', salaryPayment, errors: null });
}

async function pay(req, res) {
  const salaryPayment = await TrainerSalaryPayment.findByPk(req.params.id);
  if (!salaryPayment) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    const full = await TrainerSalaryPayment.findByPk(req.params.id, { include: [{ model: Trainer, as: 'trainer' }] });
    return res.status(422).render('salaryPayments/pay', { title: 'Record Salary Payment', salaryPayment: full, errors });
  }

  const oldValue = salaryPayment.toJSON();
  await salaryPayment.update({
    bonus_amount: req.body.bonus_amount || 0,
    deduction_amount: req.body.deduction_amount || 0,
    payment_date: req.body.payment_date,
    payment_mode: req.body.payment_mode,
    status: req.body.status,
    recorded_by: req.currentUser.id,
    notes: req.body.notes || salaryPayment.notes,
  });
  await logAction(req, { action: 'pay', entityType: 'TrainerSalaryPayment', entityId: salaryPayment.id, oldValue, newValue: salaryPayment.toJSON() });

  req.setFlash('success', 'Salary payment recorded.');
  res.redirect('/salary-payments');
}

async function trainerHistory(req, res) {
  const trainer = await Trainer.findByPk(req.params.trainerId);
  if (!trainer) return res.status(404).render('errors/404', { title: 'Not found' });

  const payments = await TrainerSalaryPayment.findAll({
    where: { trainer_id: trainer.id },
    order: [['for_year', 'DESC'], ['for_month', 'DESC']],
  });

  res.render('salaryPayments/history', { title: `${trainer.name} - Salary History`, trainer, payments, monthNames: MONTH_NAMES });
}

module.exports = { index, generateForMonth, payForm, pay, trainerHistory, MONTH_NAMES };
