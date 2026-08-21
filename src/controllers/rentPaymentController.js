const { RentPayment, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { syncRentStatus } = require('../utils/rentStatus');
const { rentDueDay, dueDateForCenter, daysUntil } = require('../utils/rentDueCalc');
const { buildNeftWorkbook } = require('../utils/neftExport');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

// Due date used to just be the last calendar day of the target month for
// every center alike. Now uses the same per-center day-of-month logic as
// the "Generate Payment Batch" flow below (dueDateForCenter) — a center
// whose lease started on the 5th is due the 5th of every following month,
// not the 30th/31st.
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
      due_date: dueDateForCenter(center, month, year),
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

// GET /rent-payments/generate-batch — every active center's rent due date
// this cycle, computed from ITS OWN lease_start_date day-of-month rather
// than one fixed date for everyone, so centers can be paid in batches as
// their individual month completes (e.g. around the 10th for centers due
// day 1-9, around the 20th for day 10-20, and so on) instead of all at
// once. from_day/to_day filter by that day-of-month, not by the resulting
// calendar due_date.
async function generateBatchForm(req, res) {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const fromDay = req.query.from_day ? parseInt(req.query.from_day, 10) : null;
  const toDay = req.query.to_day ? parseInt(req.query.to_day, 10) : null;

  const centers = await TrainingCenter.findAll({ where: { is_active: true } });
  const existingPayments = await RentPayment.findAll({ where: { for_month: month, for_year: year, training_center_id: centers.map((c) => c.id) } });
  const paymentByCenterId = new Map(existingPayments.map((p) => [p.training_center_id, p]));

  let rows = centers.map((center) => {
    const rentDay = rentDueDay(center);
    const dueDate = dueDateForCenter(center, month, year);
    const existing = paymentByCenterId.get(center.id);
    return {
      center,
      rentDay,
      dueDate,
      daysUntilDue: daysUntil(dueDate),
      existing,
      alreadyPaid: existing && existing.status === 'paid',
      missingBankDetails: !center.owner_bank_account_number || !center.owner_ifsc_code,
    };
  });

  if (fromDay) rows = rows.filter((r) => r.rentDay >= fromDay);
  if (toDay) rows = rows.filter((r) => r.rentDay <= toDay);
  rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  res.render('rentPayments/generateBatch', {
    title: 'Generate Rent Payment Batch',
    rows,
    month,
    year,
    fromDay: fromDay || '',
    toDay: toDay || '',
  });
}

// POST /rent-payments/generate-batch — creates/updates each selected
// center's RentPayment row for the month (using ITS OWN computed due
// date, not the old fixed-last-day-of-month default), skipping anything
// already fully paid, then streams the NEFT/RTGS bank file for centers
// with usable owner bank details.
async function generateBatch(req, res) {
  const month = parseInt(req.body.month, 10);
  const year = parseInt(req.body.year, 10);
  const centerIds = [].concat(req.body.center_ids || []);

  if (centerIds.length === 0) {
    req.setFlash('error', 'Select at least one center to generate rent for.');
    return res.redirect(`/rent-payments/generate-batch?month=${month}&year=${year}`);
  }

  const centers = await TrainingCenter.findAll({ where: { id: centerIds, is_active: true } });

  const included = [];
  const skippedAlreadyPaid = [];
  const skippedNoBankDetails = [];

  for (const center of centers) {
    const dueDate = dueDateForCenter(center, month, year);
    // eslint-disable-next-line no-await-in-loop
    let rent = await RentPayment.findOne({ where: { training_center_id: center.id, for_month: month, for_year: year } });

    if (rent && rent.status === 'paid') {
      skippedAlreadyPaid.push(center.name);
      continue; // eslint-disable-line no-continue
    }
    if (rent) {
      // eslint-disable-next-line no-await-in-loop
      await rent.update({ amount_due: center.monthly_rent_amount, due_date: dueDate });
    } else {
      // eslint-disable-next-line no-await-in-loop
      rent = await RentPayment.create({
        training_center_id: center.id,
        for_month: month,
        for_year: year,
        amount_due: center.monthly_rent_amount,
        amount_paid: 0,
        due_date: dueDate,
        status: 'pending',
      });
    }

    if (!center.owner_bank_account_number || !center.owner_ifsc_code) {
      skippedNoBankDetails.push(center.name);
      continue; // eslint-disable-line no-continue -- rent due was still recorded above, just not in the bank file
    }

    const netAmount = Math.max(Number(rent.amount_due) - Number(rent.amount_paid), 0);
    included.push({
      accountNumber: center.owner_bank_account_number,
      name: center.landlord_name || center.name,
      amount: netAmount,
      ifscCode: center.owner_ifsc_code,
      email: center.email,
      bankName: center.owner_bank_name,
    });
  }

  await logAction(req, {
    action: 'generate',
    entityType: 'RentPayment',
    entityId: null,
    newValue: { month, year, centerCount: centers.length, exportedCount: included.length },
  });

  const skipParts = [];
  if (skippedAlreadyPaid.length > 0) skipParts.push(`already paid this month, left untouched: ${skippedAlreadyPaid.join(', ')}`);
  if (skippedNoBankDetails.length > 0) skipParts.push(`missing owner bank details: ${skippedNoBankDetails.join(', ')}`);

  if (included.length === 0) {
    req.setFlash('error', `No centers were exported — ${skipParts.length > 0 ? skipParts.join('; ') : 'nothing to export.'}`);
    return res.redirect(`/rent-payments/generate-batch?month=${month}&year=${year}`);
  }
  if (skipParts.length > 0) {
    req.setFlash('error', `Some centers were skipped from the Excel — ${skipParts.join('; ')}.`);
  }

  const buffer = buildNeftWorkbook(included);
  const filename = `Rent-NEFT-${MONTH_NAMES[month - 1]}-${year}.xls`;

  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { index, generateForMonth, newForm, create, payForm, pay, generateBatchForm, generateBatch, MONTH_NAMES };
