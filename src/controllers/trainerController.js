const { Op } = require('sequelize');
const { Trainer, Batch, DailyAdmissionCount, MobilizationForm, Enrollment } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { MOBILIZATION_VIEW_ROLES } = require('../utils/roles');

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
    bank_branch: body.bank_branch || null,
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

// The mobilization figures "belong to" a trainer just as much as their
// batches/salary do — this rolls up the same funnel the Mobilization
// Summary shows (see mobilizationController.summary), but scoped to one
// trainer across every center they've worked at, for their own profile
// page. Kept view-gated (not route-gated) the same way the salary-history
// link on this page already is, since the trainer record itself has no
// role restriction.
async function loadMobilizationStats(trainerId) {
  const [dailyCounts, forms, enrollments] = await Promise.all([
    DailyAdmissionCount.findAll({ where: { trainer_id: trainerId }, attributes: ['admissions_count'] }),
    MobilizationForm.findAll({
      where: { trainer_id: trainerId },
      attributes: ['forms_submitted_count', 'forms_accepted_count', 'forms_verified_count'],
    }),
    Enrollment.count({ include: [{ model: Batch, as: 'batch', required: true, where: { trainer_id: trainerId } }] }),
  ]);

  return {
    totalAdmissions: dailyCounts.reduce((sum, d) => sum + Number(d.admissions_count), 0),
    totalSubmitted: forms.reduce((sum, f) => sum + Number(f.forms_submitted_count), 0),
    totalAccepted: forms.reduce((sum, f) => sum + Number(f.forms_accepted_count || 0), 0),
    totalVerified: forms.reduce((sum, f) => sum + Number(f.forms_verified_count || 0), 0),
    totalEnrolled: enrollments,
  };
}

async function show(req, res) {
  const trainer = await Trainer.findByPk(req.params.id, { include: [{ model: Batch, as: 'batches' }] });
  if (!trainer) return res.status(404).render('errors/404', { title: 'Not found' });

  const showMobilization = MOBILIZATION_VIEW_ROLES.includes(req.currentUser.role) || req.currentUser.role === 'master_admin';
  const mobilizationStats = showMobilization ? await loadMobilizationStats(trainer.id) : null;

  res.render('trainers/show', { title: trainer.name, trainer, mobilizationStats });
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
