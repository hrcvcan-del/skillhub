const { Op } = require('sequelize');
const { Scheme, SchemePhase, TrainingCenter, Batch, Course, Enrollment, Student } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { buildMisWorkbook } = require('../utils/misReport');

async function index(req, res) {
  const search = req.query.q || '';
  const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

  const total = await Scheme.count({ where });
  const pagination = buildPagination(req, total);
  const schemes = await Scheme.findAll({
    where,
    include: [{ model: SchemePhase, as: 'phases' }],
    order: [['name', 'ASC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('schemes/index', { title: 'Schemes', schemes, search, pagination });
}

async function show(req, res) {
  const scheme = await Scheme.findByPk(req.params.id, {
    include: [
      {
        model: SchemePhase,
        as: 'phases',
        include: [{ model: TrainingCenter, as: 'centers' }],
      },
    ],
    order: [[{ model: SchemePhase, as: 'phases' }, 'start_date', 'ASC']],
  });
  if (!scheme) return res.status(404).render('errors/404', { title: 'Not found' });

  res.render('schemes/show', { title: scheme.name, scheme, errors: null });
}

function newForm(req, res) {
  res.render('schemes/form', { title: 'New Scheme', scheme: {}, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('schemes/form', { title: 'New Scheme', scheme: req.body, errors });
  }

  const scheme = await Scheme.create({
    name: req.body.name,
    funding_agency: req.body.funding_agency || null,
    description: req.body.description || null,
    report_heading: req.body.report_heading || null,
  });
  await logAction(req, { action: 'create', entityType: 'Scheme', entityId: scheme.id, newValue: scheme.toJSON() });

  req.setFlash('success', 'Scheme created.');
  res.redirect(`/schemes/${scheme.id}`);
}

async function editForm(req, res) {
  const scheme = await Scheme.findByPk(req.params.id);
  if (!scheme) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('schemes/form', { title: 'Edit Scheme', scheme, errors: null });
}

async function update(req, res) {
  const scheme = await Scheme.findByPk(req.params.id);
  if (!scheme) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('schemes/form', {
      title: 'Edit Scheme',
      scheme: { ...scheme.toJSON(), ...req.body },
      errors,
    });
  }

  const oldValue = scheme.toJSON();
  await scheme.update({
    name: req.body.name,
    funding_agency: req.body.funding_agency || null,
    description: req.body.description || null,
    report_heading: req.body.report_heading || null,
    is_active: req.body.is_active === 'on' || req.body.is_active === 'true',
  });
  await logAction(req, { action: 'update', entityType: 'Scheme', entityId: scheme.id, oldValue, newValue: scheme.toJSON() });

  req.setFlash('success', 'Scheme updated.');
  res.redirect(`/schemes/${scheme.id}`);
}

async function destroy(req, res) {
  const scheme = await Scheme.findByPk(req.params.id);
  if (!scheme) return res.status(404).render('errors/404', { title: 'Not found' });

  const phaseCount = await SchemePhase.count({ where: { scheme_id: scheme.id } });
  if (phaseCount > 0) {
    req.setFlash('error', 'Cannot delete a scheme that has phases. Remove its phases first.');
    return res.redirect('/schemes');
  }

  await logAction(req, { action: 'delete', entityType: 'Scheme', entityId: scheme.id, oldValue: scheme.toJSON() });
  await scheme.destroy();

  req.setFlash('success', 'Scheme deleted.');
  res.redirect('/schemes');
}

// --- Phases (nested under a scheme) ---

async function createPhase(req, res) {
  const scheme = await Scheme.findByPk(req.params.schemeId);
  if (!scheme) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    req.setFlash('error', errors.map((e) => e.message).join(', '));
    return res.redirect(`/schemes/${scheme.id}`);
  }

  const phase = await SchemePhase.create({
    scheme_id: scheme.id,
    name: req.body.name,
    target_candidates: req.body.target_candidates || 0,
    start_date: req.body.start_date || null,
    end_date: req.body.end_date || null,
    status: req.body.status || 'planning',
    notes: req.body.notes || null,
  });
  await logAction(req, { action: 'create', entityType: 'SchemePhase', entityId: phase.id, newValue: phase.toJSON() });

  req.setFlash('success', `Phase "${phase.name}" added.`);
  res.redirect(`/schemes/${scheme.id}`);
}

async function editPhaseForm(req, res) {
  const phase = await SchemePhase.findOne({
    where: { id: req.params.id, scheme_id: req.params.schemeId },
    include: [{ model: Scheme, as: 'scheme' }],
  });
  if (!phase) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('schemes/phase-form', { title: 'Edit Phase', phase, errors: null });
}

async function updatePhase(req, res) {
  const phase = await SchemePhase.findOne({ where: { id: req.params.id, scheme_id: req.params.schemeId } });
  if (!phase) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    const full = await SchemePhase.findByPk(phase.id, { include: [{ model: Scheme, as: 'scheme' }] });
    return res.status(422).render('schemes/phase-form', { title: 'Edit Phase', phase: full, errors });
  }

  const oldValue = phase.toJSON();
  await phase.update({
    name: req.body.name,
    target_candidates: req.body.target_candidates || 0,
    start_date: req.body.start_date || null,
    end_date: req.body.end_date || null,
    status: req.body.status || 'planning',
    notes: req.body.notes || null,
  });
  await logAction(req, { action: 'update', entityType: 'SchemePhase', entityId: phase.id, oldValue, newValue: phase.toJSON() });

  req.setFlash('success', 'Phase updated.');
  res.redirect(`/schemes/${phase.scheme_id}`);
}

async function destroyPhase(req, res) {
  const phase = await SchemePhase.findOne({ where: { id: req.params.id, scheme_id: req.params.schemeId } });
  if (!phase) return res.status(404).render('errors/404', { title: 'Not found' });

  const centerCount = await TrainingCenter.count({ where: { scheme_phase_id: phase.id } });
  if (centerCount > 0) {
    req.setFlash('error', 'Cannot delete a phase with centers assigned to it.');
    return res.redirect(`/schemes/${phase.scheme_id}`);
  }

  await logAction(req, { action: 'delete', entityType: 'SchemePhase', entityId: phase.id, oldValue: phase.toJSON() });
  const schemeId = phase.scheme_id;
  await phase.destroy();

  req.setFlash('success', 'Phase deleted.');
  res.redirect(`/schemes/${schemeId}`);
}

// Flat "how many admitted so far against target" MIS export: every
// enrolled candidate across every batch at every training center under one
// scheme phase, in a single sheet — see src/utils/misReport.js.
async function exportPhaseMis(req, res) {
  const phase = await SchemePhase.findOne({
    where: { id: req.params.id, scheme_id: req.params.schemeId },
    include: [{ model: Scheme, as: 'scheme' }],
  });
  if (!phase) return res.status(404).render('errors/404', { title: 'Not found' });

  const centers = await TrainingCenter.findAll({ where: { scheme_phase_id: phase.id }, attributes: ['id'] });
  const centerIds = centers.map((c) => c.id);

  const batches = centerIds.length
    ? await Batch.findAll({
        where: { training_center_id: centerIds },
        include: [
          { model: Course, as: 'course' },
          { model: TrainingCenter, as: 'trainingCenter' },
          {
            model: Enrollment,
            as: 'enrollments',
            required: false,
            include: [{ model: Student, as: 'student' }],
            separate: true,
            order: [['enrollment_date', 'ASC']],
          },
        ],
      })
    : [];

  const rows = [];
  batches.forEach((batch) => {
    (batch.enrollments || []).forEach((enrollment) => {
      rows.push({ student: enrollment.student, batch });
    });
  });

  const buffer = buildMisWorkbook(rows);
  const filename = `MIS-${(phase.scheme.name + '-' + phase.name).replace(/[^a-z0-9]+/gi, '-')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = {
  index,
  show,
  newForm,
  create,
  editForm,
  update,
  destroy,
  createPhase,
  editPhaseForm,
  updatePhase,
  destroyPhase,
  exportPhaseMis,
};
