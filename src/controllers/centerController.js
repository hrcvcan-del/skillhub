const { Op } = require('sequelize');
const { TrainingCenter, Batch, Course, SchemePhase, Scheme, User } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { buildCenterTemplateWorkbook, parseCenterBulkFile } = require('../utils/centerBulkUpload');

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
    owner_ifsc_code: body.owner_ifsc_code || null,
    owner_bank_name: body.owner_bank_name || null,
    owner_bank_branch: body.owner_bank_branch || null,
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
  // center_coordinator can create a center but can't view the list/detail
  // page it would normally redirect to (see routes/centers.js) — send
  // them somewhere they can actually see instead.
  res.redirect(req.currentUser.role === 'center_coordinator' ? '/dashboard' : '/centers');
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

function bulkUploadForm(req, res) {
  res.render('centers/bulkUpload', { title: 'Bulk Upload Training Centers', results: null, errors: null });
}

function downloadTemplate(req, res) {
  const buffer = buildCenterTemplateWorkbook();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="training-centers-template.xlsx"');
  res.send(buffer);
}

async function bulkUpload(req, res) {
  const rerender = (formErrors) =>
    res.status(422).render('centers/bulkUpload', { title: 'Bulk Upload Training Centers', results: null, errors: formErrors });

  if (!req.file) {
    return rerender([{ field: 'file', message: 'Please choose a CSV, XLS, or XLSX file to upload' }]);
  }

  let parsed;
  try {
    parsed = parseCenterBulkFile(req.file.path);
  } catch (err) {
    return rerender([{ field: 'file', message: err.message }]);
  }

  if (parsed.warning) {
    return rerender([{ field: 'file', message: parsed.warning }]);
  }
  if (parsed.rows.length === 0) {
    return rerender([{ field: 'file', message: 'No center rows were found in this file. Rows need at least a Center Name.' }]);
  }

  const [phases, coordinators, existingNames] = await Promise.all([
    SchemePhase.findAll(),
    User.findAll({ where: { role: ['center_coordinator', 'admin', 'director', 'manager'] } }),
    TrainingCenter.findAll({ attributes: ['name'] }),
  ]);
  const phaseByName = new Map(phases.map((p) => [p.name.trim().toLowerCase(), p]));
  const coordinatorByEmail = new Map(coordinators.map((c) => [(c.email || '').trim().toLowerCase(), c]));
  const nameSeenAlready = new Set(existingNames.map((c) => c.name.trim().toLowerCase()));

  const created = [];
  const skipped = [];

  for (const row of parsed.rows) {
    const { rowNumber, data } = row;
    const rowErrors = [];

    if (!data.monthly_rent_amount && data.monthly_rent_amount !== 0) {
      rowErrors.push('Monthly Rent Amount is required and must be a number');
    }
    if (nameSeenAlready.has(data.name.trim().toLowerCase())) {
      rowErrors.push(`A training center named "${data.name}" already exists`);
    }

    let schemePhaseId = null;
    if (data.scheme_phase_name) {
      const phase = phaseByName.get(data.scheme_phase_name.trim().toLowerCase());
      if (!phase) {
        rowErrors.push(`Scheme Phase "${data.scheme_phase_name}" was not found`);
      } else {
        schemePhaseId = phase.id;
      }
    }

    let coordinatorId = null;
    if (data.coordinator_email) {
      const coordinator = coordinatorByEmail.get(data.coordinator_email.trim().toLowerCase());
      if (!coordinator) {
        rowErrors.push(`Coordinator with email "${data.coordinator_email}" was not found`);
      } else {
        coordinatorId = coordinator.id;
      }
    }

    if (rowErrors.length > 0) {
      skipped.push({ rowNumber, name: data.name, errors: rowErrors });
      continue; // eslint-disable-line no-continue
    }

    // eslint-disable-next-line no-await-in-loop
    const center = await TrainingCenter.create({
      name: data.name,
      address: data.address,
      city: data.city,
      district: data.district,
      phone: data.phone,
      email: data.email,
      capacity: data.capacity,
      monthly_rent_amount: data.monthly_rent_amount,
      landlord_name: data.landlord_name,
      landlord_contact: data.landlord_contact,
      lease_start_date: data.lease_start_date,
      lease_end_date: data.lease_end_date,
      planned_closure_date: data.planned_closure_date,
      scheme_phase_id: schemePhaseId,
      coordinator_id: coordinatorId,
      owner_bank_account_number: data.owner_bank_account_number,
      owner_upi_id: data.owner_upi_id,
      is_active: true,
    });
    // eslint-disable-next-line no-await-in-loop
    await logAction(req, { action: 'create', entityType: 'TrainingCenter', entityId: center.id, newValue: center.toJSON() });
    nameSeenAlready.add(data.name.trim().toLowerCase());
    created.push({ rowNumber, name: data.name, id: center.id });
  }

  res.render('centers/bulkUpload', {
    title: 'Bulk Upload Training Centers',
    results: { created, skipped, totalRows: parsed.rows.length },
    errors: null,
  });
}

module.exports = {
  index,
  show,
  newForm,
  create,
  editForm,
  update,
  destroy,
  bulkUploadForm,
  downloadTemplate,
  bulkUpload,
};
