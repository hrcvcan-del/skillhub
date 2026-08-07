const { Op } = require('sequelize');
const { TrainingCenter, Batch, Course, SchemePhase, Scheme, User } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

function pickFields(body, { isUpdate = false } = {}) {
  return {
    name: body.name,
    address: body.address || null,
    city: body.city || null,
    district: body.district || null,
    phone: body.phone || null,
    email: body.email || null,
    capacity: body.capacity || null,
    monthly_rent_amount: body.monthly_rent_amount || 0,
    landlord_name: body.landlord_name || null,
    landlord_contact: body.landlord_contact || null,
    lease_start_date: body.lease_start_date || null,
    lease_end_date: body.lease_end_date || null,
    scheme_phase_id: body.scheme_phase_id || null,
    coordinator_id: body.coordinator_id || null,
    owner_bank_account_number: body.owner_bank_account_number || null,
    owner_upi_id: body.owner_upi_id || null,
    planned_closure_date: body.planned_closure_date || null,
    is_active: isUpdate ? body.is_active === 'on' || body.is_active === 'true' : true,
  };
}

async function loadFormOptions() {
  const [phases, coordinators] = await Promise.all([
    SchemePhase.findAll({ include: [{ model: Scheme, as: 'scheme' }], order: [['name', 'ASC']] }),
    User.findAll({
      where: { role: ['center_coordinator', 'admin', 'director', 'manager'], is_active: true },
      order: [['name', 'ASC']],
    }),
  ]);
  return { phases, coordinators };
}

async function index(req, res) {
  const search = req.query.q || '';
  const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

  const total = await TrainingCenter.count({ where });
  const pagination = buildPagination(req, total);
  const centers = await TrainingCenter.findAll({
    where,
    include: [
      { model: SchemePhase, as: 'schemePhase', include: [{ model: Scheme, as: 'scheme' }] },
      { model: User, as: 'coordinator' },
    ],
    order: [['name', 'ASC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('centers/index', { title: 'Training Centers', centers, search, pagination });
}

async function show(req, res) {
  const center = await TrainingCenter.findByPk(req.params.id, {
    include: [
      { model: Batch, as: 'batches', include: [{ model: Course, as: 'course' }] },
      { model: SchemePhase, as: 'schemePhase', include: [{ model: Scheme, as: 'scheme' }] },
      { model: User, as: 'coordinator' },
    ],
  });
  if (!center) return res.status(404).render('errors/404', { title: 'Not found' });

  const activeBatches = center.batches.filter((b) => b.status !== 'cancelled' && b.status !== 'completed');
  res.render('centers/show', { title: center.name, center, activeBatches });
}

async function newForm(req, res) {
  const options = await loadFormOptions();
  res.render('centers/form', { title: 'New Training Center', center: {}, errors: null, ...options });
}

async function create(req, res) {
  const errors = getErrors(req);
  const options = await loadFormOptions();

  if (errors) {
    return res.status(422).render('centers/form', { title: 'New Training Center', center: req.body, errors, ...options });
  }

  const center = await TrainingCenter.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'TrainingCenter', entityId: center.id, newValue: center.toJSON() });

  req.setFlash('success', 'Training center created.');
  res.redirect('/centers');
}

async function editForm(req, res) {
  const center = await TrainingCenter.findByPk(req.params.id);
  if (!center) return res.status(404).render('errors/404', { title: 'Not found' });
  const options = await loadFormOptions();
  res.render('centers/form', { title: 'Edit Training Center', center, errors: null, ...options });
}

async function update(req, res) {
  const center = await TrainingCenter.findByPk(req.params.id);
  if (!center) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  const options = await loadFormOptions();

  if (errors) {
    return res.status(422).render('centers/form', {
      title: 'Edit Training Center',
      center: { ...center.toJSON(), ...req.body },
      errors,
      ...options,
    });
  }

  const oldValue = center.toJSON();
  await center.update(pickFields(req.body, { isUpdate: true }));
  await logAction(req, { action: 'update', entityType: 'TrainingCenter', entityId: center.id, oldValue, newValue: center.toJSON() });

  req.setFlash('success', 'Training center updated.');
  res.redirect('/centers');
}

async function destroy(req, res) {
  const center = await TrainingCenter.findByPk(req.params.id);
  if (!center) return res.status(404).render('errors/404', { title: 'Not found' });

  const batchCount = await Batch.count({ where: { training_center_id: center.id } });
  if (batchCount > 0) {
    req.setFlash('error', 'Cannot delete a center that has batches. Deactivate it instead.');
    return res.redirect('/centers');
  }

  await logAction(req, { action: 'delete', entityType: 'TrainingCenter', entityId: center.id, oldValue: center.toJSON() });
  await center.destroy();

  req.setFlash('success', 'Training center deleted.');
  res.redirect('/centers');
}

module.exports = { index, show, newForm, create, editForm, update, destroy };
