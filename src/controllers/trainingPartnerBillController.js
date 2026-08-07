const { Op } = require('sequelize');
const { TrainingPartnerBill, TrainingPartnerCandidate, TrainingPartner, User } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { getOwnTrainingPartnerId } = require('../utils/trainingPartnerScope');
const { FINANCE_ROLES } = require('../utils/roles');
const { buildPagination } = require('../utils/listQuery');

function isFinance(user) {
  return FINANCE_ROLES.includes(user.role) || user.role === 'master_admin';
}

// Finance Director sees every partner's bills (optionally filtered by
// partner/status); a training_partner login sees only their own.
async function index(req, res) {
  const ownId = getOwnTrainingPartnerId(req.currentUser);
  const where = {};
  if (ownId) {
    where.training_partner_id = ownId;
  } else if (req.query.training_partner_id) {
    where.training_partner_id = req.query.training_partner_id;
  }
  if (req.query.status) where.status = req.query.status;

  const total = await TrainingPartnerBill.count({ where });
  const pagination = buildPagination(req, total);
  const bills = await TrainingPartnerBill.findAll({
    where,
    include: [{ model: TrainingPartner, as: 'trainingPartner' }],
    order: [['created_at', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const partners = ownId ? [] : await TrainingPartner.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  res.render('trainingPartnerBills/index', {
    title: 'Training Partner Bills',
    bills,
    partners,
    isFinance: isFinance(req.currentUser),
    filters: {
      training_partner_id: req.query.training_partner_id || '',
      status: req.query.status || '',
    },
    pagination,
  });
}

// training_partner picks a period; every one of their own unbilled
// candidates trained in that window gets rolled into the new bill.
async function newForm(req, res) {
  res.render('trainingPartnerBills/form', {
    title: 'Generate Bill',
    errors: null,
    defaultFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    defaultTo: new Date().toISOString().slice(0, 10),
  });
}

async function create(req, res) {
  const trainingPartnerId = getOwnTrainingPartnerId(req.currentUser);
  const errors = getErrors(req);
  if (errors) {
    req.setFlash('error', errors.map((e) => e.message).join(', '));
    return res.redirect('/training-partner-bills/new');
  }

  const { period_from: periodFrom, period_to: periodTo } = req.body;
  const candidates = await TrainingPartnerCandidate.findAll({
    where: {
      training_partner_id: trainingPartnerId,
      bill_id: null,
      trained_date: { [Op.between]: [periodFrom, periodTo] },
    },
  });

  if (candidates.length === 0) {
    req.setFlash('error', 'No unbilled candidates found in that date range.');
    return res.redirect('/training-partner-bills/new');
  }

  const grossAmount = candidates.reduce((sum, c) => sum + Number(c.training_cost), 0);

  const bill = await TrainingPartnerBill.create({
    training_partner_id: trainingPartnerId,
    period_from: periodFrom,
    period_to: periodTo,
    candidate_count: candidates.length,
    gross_amount: grossAmount,
    status: 'pending_review',
    generated_by: req.currentUser.id,
  });

  await TrainingPartnerCandidate.update({ bill_id: bill.id }, { where: { id: candidates.map((c) => c.id) } });
  await logAction(req, { action: 'create', entityType: 'TrainingPartnerBill', entityId: bill.id, newValue: bill.toJSON() });

  req.setFlash('success', `Bill generated for ${candidates.length} candidate(s), ₹${grossAmount.toLocaleString('en-IN')}. Awaiting Finance Director review.`);
  res.redirect('/training-partner-bills');
}

async function loadDetail(id) {
  return TrainingPartnerBill.findByPk(id, {
    include: [
      { model: TrainingPartner, as: 'trainingPartner' },
      { model: TrainingPartnerCandidate, as: 'candidates' },
      { model: User, as: 'generatedByUser' },
      { model: User, as: 'reviewedByUser' },
    ],
  });
}

async function show(req, res) {
  const ownId = getOwnTrainingPartnerId(req.currentUser);
  const bill = await loadDetail(req.params.id);
  if (!bill) return res.status(404).render('errors/404', { title: 'Not found' });
  if (ownId && bill.training_partner_id !== ownId) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  res.render('trainingPartnerBills/show', { title: `Bill #${bill.id}`, bill, isFinance: isFinance(req.currentUser) });
}

// Finance Director sets the deduction % and approves in one step.
async function approve(req, res) {
  const bill = await TrainingPartnerBill.findByPk(req.params.id);
  if (!bill) return res.status(404).render('errors/404', { title: 'Not found' });
  if (bill.status !== 'pending_review') {
    req.setFlash('error', 'Only bills awaiting review can be approved.');
    return res.redirect(`/training-partner-bills/${bill.id}`);
  }

  const deductionPercent = Number(req.body.deduction_percent);
  if (Number.isNaN(deductionPercent) || deductionPercent < 0 || deductionPercent > 100) {
    req.setFlash('error', 'Enter a deduction percentage between 0 and 100.');
    return res.redirect(`/training-partner-bills/${bill.id}`);
  }

  const deductionAmount = Math.round(Number(bill.gross_amount) * (deductionPercent / 100) * 100) / 100;
  const netAmount = Number(bill.gross_amount) - deductionAmount;

  const oldValue = bill.toJSON();
  await bill.update({
    deduction_percent: deductionPercent,
    deduction_amount: deductionAmount,
    net_amount: netAmount,
    status: 'approved',
    reviewed_by: req.currentUser.id,
    reviewed_at: new Date(),
  });
  await logAction(req, { action: 'approve', entityType: 'TrainingPartnerBill', entityId: bill.id, oldValue, newValue: bill.toJSON() });

  req.setFlash('success', `Bill approved. Net payable: ₹${netAmount.toLocaleString('en-IN')} (${deductionPercent}% deducted).`);
  res.redirect(`/training-partner-bills/${bill.id}`);
}

// Rejecting frees the candidate entries back up so they can be included
// in a future bill.
async function reject(req, res) {
  const bill = await TrainingPartnerBill.findByPk(req.params.id);
  if (!bill) return res.status(404).render('errors/404', { title: 'Not found' });
  if (bill.status !== 'pending_review') {
    req.setFlash('error', 'Only bills awaiting review can be rejected.');
    return res.redirect(`/training-partner-bills/${bill.id}`);
  }

  const oldValue = bill.toJSON();
  await TrainingPartnerCandidate.update({ bill_id: null }, { where: { bill_id: bill.id } });
  await bill.update({ status: 'rejected', reviewed_by: req.currentUser.id, reviewed_at: new Date(), notes: req.body.notes || bill.notes });
  await logAction(req, { action: 'reject', entityType: 'TrainingPartnerBill', entityId: bill.id, oldValue, newValue: bill.toJSON() });

  req.setFlash('success', 'Bill rejected; its candidate entries are unbilled again.');
  res.redirect('/training-partner-bills');
}

module.exports = { index, newForm, create, show, approve, reject };
