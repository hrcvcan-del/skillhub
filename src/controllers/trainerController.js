const { Op } = require('sequelize');
const { Trainer, Batch, DailyAdmissionCount, MobilizationForm, Enrollment } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { MOBILIZATION_VIEW_ROLES } = require('../utils/roles');
const { buildTrainerTemplateWorkbook, parseTrainerBulkFile } = require('../utils/trainerBulkUpload');

// req.files comes from multer's .fields() — undefined entirely if no files
// were attached to this submission at all.
function uploadedFileUrl(req, fieldName) {
  const file = req.files && req.files[fieldName] && req.files[fieldName][0];
  return file ? `/uploads/${file.filename}` : null;
}

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

  const trainer = await Trainer.create({
    ...pickFields(req.body),
    aadhar_card_url: uploadedFileUrl(req, 'aadhar_card'),
    education_certificate_url: uploadedFileUrl(req, 'education_certificate'),
  });
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
  await trainer.update({
    ...pickFields(req.body, { isUpdate: true }),
    aadhar_card_url: uploadedFileUrl(req, 'aadhar_card') || trainer.aadhar_card_url,
    education_certificate_url: uploadedFileUrl(req, 'education_certificate') || trainer.education_certificate_url,
  });
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

// GET /trainers/upload — bulk-add trainers from an Excel/CSV list, same
// applied/skipped report pattern as the Centers and Equipment bulk uploads.
function uploadForm(req, res) {
  res.render('trainers/upload', { title: 'Bulk Upload Trainers', results: null, errors: null });
}

function downloadTemplate(req, res) {
  const buffer = buildTrainerTemplateWorkbook();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="trainers-template.xlsx"');
  res.send(buffer);
}

async function upload(req, res) {
  const rerender = (formErrors) =>
    res.status(422).render('trainers/upload', { title: 'Bulk Upload Trainers', results: null, errors: formErrors });

  if (!req.file) {
    return rerender([{ field: 'file', message: 'Please choose a CSV, XLS, or XLSX file to upload' }]);
  }

  let parsed;
  try {
    parsed = parseTrainerBulkFile(req.file.path);
  } catch (err) {
    return rerender([{ field: 'file', message: err.message }]);
  }
  if (parsed.warning) return rerender([{ field: 'file', message: parsed.warning }]);
  if (parsed.rows.length === 0) {
    return rerender([{ field: 'file', message: 'No trainer rows were found in this file. Rows need at least a Trainer Name.' }]);
  }

  const existingEmails = new Set(
    (await Trainer.findAll({ where: { email: { [Op.ne]: null } }, attributes: ['email'] })).map((t) =>
      t.email.toLowerCase()
    )
  );
  const seenInFile = new Set();

  const applied = [];
  const skipped = [];

  for (const row of parsed.rows) {
    if (row.error) {
      skipped.push({ rowNumber: row.rowNumber, name: row.data.name, errors: [row.error] });
      continue; // eslint-disable-line no-continue
    }

    const emailKey = row.data.email ? row.data.email.toLowerCase() : null;
    if (emailKey && (existingEmails.has(emailKey) || seenInFile.has(emailKey))) {
      skipped.push({ rowNumber: row.rowNumber, name: row.data.name, errors: ['A trainer with this email already exists'] });
      continue; // eslint-disable-line no-continue
    }
    if (emailKey) seenInFile.add(emailKey);

    // eslint-disable-next-line no-await-in-loop
    const trainer = await Trainer.create({ ...row.data, is_active: true });
    // eslint-disable-next-line no-await-in-loop
    await logAction(req, { action: 'create', entityType: 'Trainer', entityId: trainer.id, newValue: trainer.toJSON() });
    applied.push({ rowNumber: row.rowNumber, name: trainer.name });
  }

  res.render('trainers/upload', {
    title: 'Bulk Upload Trainers',
    results: { applied, skipped, totalRows: parsed.rows.length },
    errors: null,
  });
}

module.exports = { index, show, newForm, create, editForm, update, destroy, uploadForm, downloadTemplate, upload };
