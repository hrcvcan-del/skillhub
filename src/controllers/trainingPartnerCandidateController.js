// Self-service candidate logging for the 'training_partner' role only —
// always scoped to the logged-in partner's own record.
const { Op } = require('sequelize');
const { TrainingPartnerCandidate } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { getOwnTrainingPartnerId } = require('../utils/trainingPartnerScope');
const { buildPagination } = require('../utils/listQuery');

async function index(req, res) {
  const trainingPartnerId = getOwnTrainingPartnerId(req.currentUser);
  const where = { training_partner_id: trainingPartnerId };
  if (req.query.billed === 'yes') where.bill_id = { [Op.ne]: null };
  if (req.query.billed === 'no') where.bill_id = null;

  const total = await TrainingPartnerCandidate.count({ where });
  const pagination = buildPagination(req, total);
  const candidates = await TrainingPartnerCandidate.findAll({
    where,
    order: [['trained_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('trainingPartnerCandidates/index', {
    title: 'Candidates Trained',
    candidates,
    filters: { billed: req.query.billed || '' },
    pagination,
  });
}

function newForm(req, res) {
  res.render('trainingPartnerCandidates/form', {
    title: 'Add Candidate',
    candidate: { trained_date: new Date().toISOString().slice(0, 10) },
    errors: null,
  });
}

async function create(req, res) {
  const trainingPartnerId = getOwnTrainingPartnerId(req.currentUser);
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('trainingPartnerCandidates/form', { title: 'Add Candidate', candidate: req.body, errors });
  }

  const candidate = await TrainingPartnerCandidate.create({
    training_partner_id: trainingPartnerId,
    candidate_name: req.body.candidate_name,
    training_cost: req.body.training_cost,
    trained_date: req.body.trained_date,
    notes: req.body.notes || null,
  });
  await logAction(req, { action: 'create', entityType: 'TrainingPartnerCandidate', entityId: candidate.id, newValue: candidate.toJSON() });

  req.setFlash('success', 'Candidate added.');
  res.redirect('/training-partner-candidates');
}

module.exports = { index, newForm, create };
