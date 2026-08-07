const { TrainerAdvance, Trainer } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

async function index(req, res) {
  const where = {};
  if (req.query.trainer_id) where.trainer_id = req.query.trainer_id;
  if (req.query.status) where.status = req.query.status;

  const total = await TrainerAdvance.count({ where });
  const pagination = buildPagination(req, total);
  const advances = await TrainerAdvance.findAll({
    where,
    include: [{ model: Trainer, as: 'trainer' }],
    order: [['advance_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const trainers = await Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  res.render('trainerAdvances/index', {
    title: 'Trainer Advances',
    advances,
    trainers,
    filters: {
      trainer_id: req.query.trainer_id || '',
      status: req.query.status || '',
    },
    pagination,
  });
}

async function newForm(req, res) {
  const trainers = await Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  res.render('trainerAdvances/form', {
    title: 'New Trainer Advance',
    advance: { advance_date: new Date().toISOString().slice(0, 10) },
    trainers,
    errors: null,
  });
}

async function create(req, res) {
  const errors = getErrors(req);
  const trainers = await Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  if (errors) {
    return res.status(422).render('trainerAdvances/form', {
      title: 'New Trainer Advance',
      advance: req.body,
      trainers,
      errors,
    });
  }

  const advance = await TrainerAdvance.create({
    trainer_id: req.body.trainer_id,
    amount: req.body.amount,
    advance_date: req.body.advance_date,
    notes: req.body.notes || null,
    status: 'pending',
    recorded_by: req.currentUser.id,
  });
  await logAction(req, { action: 'create', entityType: 'TrainerAdvance', entityId: advance.id, newValue: advance.toJSON() });

  req.setFlash('success', 'Advance recorded. It will be auto-deducted from this trainer\'s next generated salary due.');
  res.redirect('/trainer-advances');
}

module.exports = { index, newForm, create };
