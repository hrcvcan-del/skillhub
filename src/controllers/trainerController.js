const { Op } = require('sequelize');
const { Trainer, Batch } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

function pickFields(body, { isUpdate = false } = {}) {
  return {
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    specialization: body.specialization || null,
    qualification: body.qualification || null,
    joining_date: body.joining_date || null,
    exit_date: body.exit_date || null,
    salary_type: body.salary_type || 'monthly',
    salary_amount: body.salary_amount || 0,
    bank_account_number: body.bank_account_number || null,
    ifsc_code: body.ifsc_code || null,
    bank_name: body.bank_name || null,
    is_active: isUpdate ? body.is_active === 'on' || body.is_active === 'true' : true,
  };
}

async function index(req, res) {
  const search = req.query.q || '';
  const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

  const total = await Trainer.count({ where });
  const pagination = buildPagination(req, total);
  const trainers = await Trainer.findAll({
    where,
    order: [['name', 'ASC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('trainers/index', { title: 'Trainers', trainers, search, pagination });
}

async function show(req, res) {
  const trainer = await Trainer.findByPk(req.params.id, { include: [{ model: Batch, as: 'batches' }] });
  if (!trainer) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('trainers/show', { title: trainer.name, trainer });
}

function newForm(req, res) {
  res.render('trainers/form', { title: 'New Trainer', trainer: {}, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('trainers/form', { title: 'New Trainer', trainer: req.body, errors });
  }

  const trainer = await Trainer.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'Trainer', entityId: trainer.id, newValue: trainer.toJSON() });

  req.setFlash('success', 'Trainer created.');
  res.redirect('/trainers');
}

async function editForm(req, res) {
  const trainer = await Trainer.findByPk(req.params.id);
  if (!trainer) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('trainers/form', { title: 'Edit Trainer', trainer, errors: null });
}

async function update(req, res) {
  const trainer = await Trainer.findByPk(req.params.id);
  if (!trainer) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('trainers/form', {
      title: 'Edit Trainer',
      trainer: { ...trainer.toJSON(), ...req.body },
      errors,
    });
  }

  const oldValue = trainer.toJSON();
  await trainer.update(pickFields(req.body, { isUpdate: true }));
  await logAction(req, { action: 'update', entityType: 'Trainer', entityId: trainer.id, oldValue, newValue: trainer.toJSON() });

  req.setFlash('success', 'Trainer updated.');
  res.redirect('/trainers');
}

async function destroy(req, res) {
  const trainer = await Trainer.findByPk(req.params.id);
  if (!trainer) return res.status(404).render('errors/404', { title: 'Not found' });

  const batchCount = await Batch.count({ where: { trainer_id: trainer.id } });
  if (batchCount > 0) {
    req.setFlash('error', 'Cannot delete a trainer assigned to batches. Deactivate instead.');
    return res.redirect('/trainers');
  }

  await logAction(req, { action: 'delete', entityType: 'Trainer', entityId: trainer.id, oldValue: trainer.toJSON() });
  await trainer.destroy();

  req.setFlash('success', 'Trainer deleted.');
  res.redirect('/trainers');
}

module.exports = { index, show, newForm, create, editForm, update, destroy };
