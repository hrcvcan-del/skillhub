const { Batch, Course, TrainingCenter, Trainer, Enrollment, Student, SchemePhase, Scheme, User } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { generateBatchCode } = require('../utils/batchCode');
const { syncBatchStatus } = require('../utils/batchStatus');
const { getScopedCenterIds, getScopedBatchIdsForDeo, centerIdsWhereValue, NO_MATCH_ID } = require('../utils/centerScope');
const { STUDENT_ENTRY_ASSIGN_ROLES } = require('../utils/roles');
const { buildJoiningWorkbook } = require('../utils/joiningReport');
const { buildCommencementLetter } = require('../utils/commencementLetter');
const { buildFeedbackLetter } = require('../utils/feedbackLetter');
const { toDDMMYYYY } = require('../utils/reportDate');
const { combineFullName } = require('../utils/studentName');

// Shared eager-load for both report exports: course, center (with its
// scheme phase/scheme, for the report heading), and active enrollments
// with their students — alphabetical by student name (not enrollment
// date) so Joining Data, the Commencement Letter, and the Feedback
// Letter (all three consume this same list) list candidates the same
// predictable way office staff expect.
async function loadBatchForExport(id) {
  return Batch.findByPk(id, {
    include: [
      { model: Course, as: 'course' },
      {
        model: TrainingCenter,
        as: 'trainingCenter',
        include: [
          { model: SchemePhase, as: 'schemePhase', include: [{ model: Scheme, as: 'scheme' }] },
          { model: User, as: 'coordinator' },
        ],
      },
      {
        model: Enrollment,
        as: 'enrollments',
        where: { status: 'active' },
        required: false,
        include: [{ model: Student, as: 'student' }],
        separate: true,
        order: [[{ model: Student, as: 'student' }, 'name', 'ASC']],
      },
    ],
  });
}

async function loadFormOptions(centerIds) {
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds), is_active: true } : { is_active: true };
  const [courses, centers, trainers] = await Promise.all([
    Course.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] }),
    Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
  ]);
  return { courses, centers, trainers };
}

async function index(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  // A Data Entry Operator only ever sees the batch(es) assigned to them for
  // student entry (Batch.student_entry_operator_id) — same scope as their
  // Add Student flow, so "which batches can I add to" and "which batches
  // can I browse/view" are always the same set.
  const deoBatchIds = await getScopedBatchIdsForDeo(req.currentUser);
  const where = {};
  if (deoBatchIds !== null) {
    where.id = centerIdsWhereValue(deoBatchIds);
    // The Students tab's center -> batch drill-down links here with
    // ?center_id=... — combine with the DEO's own batch scope (both apply
    // as an AND) rather than ignoring it, so picking a center actually
    // narrows the list instead of always showing every assigned batch.
    if (req.query.center_id) where.training_center_id = req.query.center_id;
  } else if (req.query.center_id) {
    // A scoped user's ?center_id= filter must stay inside their own
    // centers — otherwise they could page through another center's batches
    // just by editing the query string.
    if (centerIds && !centerIds.includes(Number(req.query.center_id))) {
      where.training_center_id = NO_MATCH_ID;
    } else {
      where.training_center_id = req.query.center_id;
    }
  } else if (centerIds) {
    where.training_center_id = centerIdsWhereValue(centerIds);
  }
  if (req.query.status) where.status = req.query.status;

  const total = await Batch.count({ where });
  const pagination = buildPagination(req, total);
  const batches = await Batch.findAll({
    where,
    include: [
      { model: Course, as: 'course' },
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
      { model: User, as: 'studentEntryOperator' },
    ],
    order: [['start_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  await Promise.all(batches.map(syncBatchStatus));

  // A scoped Center Coordinator only ever sees/assigns within their own
  // centers' batches (already enforced by the `where` above), so no extra
  // scoping is needed here beyond the role check itself.
  const canAssignStudentEntry = STUDENT_ENTRY_ASSIGN_ROLES.includes(req.currentUser.role) || req.currentUser.role === 'master_admin';
  const dataEntryOperators = canAssignStudentEntry
    ? await User.findAll({ where: { role: 'data_entry_operator', is_active: true }, order: [['name', 'ASC']] })
    : [];

  const { centers } = await loadFormOptions(centerIds);
  res.render('batches/index', {
    title: 'Batches',
    batches,
    centers,
    filters: { center_id: req.query.center_id || '', status: req.query.status || '' },
    pagination,
    canAssignStudentEntry,
    dataEntryOperators,
  });
}

async function show(req, res) {
  const batch = await Batch.findByPk(req.params.id, {
    include: [
      { model: Course, as: 'course' },
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
      {
        model: Enrollment,
        as: 'enrollments',
        include: [{ model: Student, as: 'student' }],
        separate: true,
        order: [[{ model: Student, as: 'student' }, 'name', 'ASC']],
      },
    ],
  });
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && !centerIds.includes(batch.training_center_id)) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  const deoBatchIds = await getScopedBatchIdsForDeo(req.currentUser);
  if (deoBatchIds !== null && !deoBatchIds.includes(batch.id)) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  await syncBatchStatus(batch);
  const seatsRemaining = batch.capacity - batch.enrollments.filter((e) => e.status === 'active').length;
  res.render('batches/show', { title: batch.batch_code, batch, seatsRemaining, toDDMMYYYY, combineFullName });
}

async function newForm(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const options = await loadFormOptions(centerIds);
  res.render('batches/form', { title: 'New Batch', batch: {}, errors: null, ...options });
}

async function create(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const errors = getErrors(req);
  const options = await loadFormOptions(centerIds);

  if (errors) {
    return res.status(422).render('batches/form', { title: 'New Batch', batch: req.body, errors, ...options });
  }

  // A scoped Center Coordinator can only ever create a batch at one of
  // their own centers, regardless of what the submitted form says.
  if (centerIds && !centerIds.includes(Number(req.body.training_center_id))) {
    return res.status(422).render('batches/form', {
      title: 'New Batch',
      batch: req.body,
      errors: [{ field: 'training_center_id', message: 'You can only create batches at your own center' }],
      ...options,
    });
  }

  const course = options.courses.find((c) => c.id === parseInt(req.body.course_id, 10));
  if (!course) {
    return res.status(422).render('batches/form', {
      title: 'New Batch',
      batch: req.body,
      errors: [{ field: 'course_id', message: 'Invalid course selected' }],
      ...options,
    });
  }

  if (new Date(req.body.end_date) <= new Date(req.body.start_date)) {
    return res.status(422).render('batches/form', {
      title: 'New Batch',
      batch: req.body,
      errors: [{ field: 'end_date', message: 'End date must be after start date' }],
      ...options,
    });
  }

  const batch_code = await generateBatchCode(course, req.body.start_date);

  const batch = await Batch.create({
    course_id: req.body.course_id,
    training_center_id: req.body.training_center_id,
    trainer_id: req.body.trainer_id || null,
    batch_code,
    start_date: req.body.start_date,
    end_date: req.body.end_date,
    schedule_days: req.body.schedule_days || null,
    start_time: req.body.start_time || null,
    end_time: req.body.end_time || null,
    capacity: req.body.capacity || 20,
    status: 'upcoming',
    weekly_holiday: req.body.weekly_holiday || null,
    work_order_no: req.body.work_order_no || null,
    report_batch_number: req.body.report_batch_number || null,
    sanctioned_batch_size: req.body.sanctioned_batch_size || null,
  });
  await logAction(req, { action: 'create', entityType: 'Batch', entityId: batch.id, newValue: batch.toJSON() });

  req.setFlash('success', `Batch ${batch.batch_code} created.`);
  res.redirect('/batches');
}

async function editForm(req, res) {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });
  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && !centerIds.includes(batch.training_center_id)) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }
  const options = await loadFormOptions(centerIds);
  res.render('batches/form', { title: 'Edit Batch', batch, errors: null, ...options });
}

async function update(req, res) {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && !centerIds.includes(batch.training_center_id)) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  const errors = getErrors(req);
  const options = await loadFormOptions(centerIds);

  if (errors) {
    return res.status(422).render('batches/form', {
      title: 'Edit Batch',
      batch: { ...batch.toJSON(), ...req.body },
      errors,
      ...options,
    });
  }

  if (centerIds && !centerIds.includes(Number(req.body.training_center_id))) {
    return res.status(422).render('batches/form', {
      title: 'Edit Batch',
      batch: { ...batch.toJSON(), ...req.body },
      errors: [{ field: 'training_center_id', message: 'You can only manage batches at your own center' }],
      ...options,
    });
  }

  if (new Date(req.body.end_date) <= new Date(req.body.start_date)) {
    return res.status(422).render('batches/form', {
      title: 'Edit Batch',
      batch: { ...batch.toJSON(), ...req.body },
      errors: [{ field: 'end_date', message: 'End date must be after start date' }],
      ...options,
    });
  }

  const oldValue = batch.toJSON();
  await batch.update({
    course_id: req.body.course_id,
    training_center_id: req.body.training_center_id,
    trainer_id: req.body.trainer_id || null,
    start_date: req.body.start_date,
    end_date: req.body.end_date,
    schedule_days: req.body.schedule_days || null,
    start_time: req.body.start_time || null,
    end_time: req.body.end_time || null,
    capacity: req.body.capacity || 20,
    status: req.body.status || batch.status,
    weekly_holiday: req.body.weekly_holiday || null,
    work_order_no: req.body.work_order_no || null,
    report_batch_number: req.body.report_batch_number || null,
    sanctioned_batch_size: req.body.sanctioned_batch_size || null,
  });
  await logAction(req, { action: 'update', entityType: 'Batch', entityId: batch.id, oldValue, newValue: batch.toJSON() });

  req.setFlash('success', 'Batch updated.');
  res.redirect('/batches');
}

// POST /batches/:id/assign-student-entry — sets (or clears, with an empty
// selection) which Data Entry Operator is allowed to add students to this
// batch. A scoped Center Coordinator can only assign for a batch at their
// own center — same rule as every other batch mutation.
async function assignStudentEntryOperator(req, res) {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && !centerIds.includes(batch.training_center_id)) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  const oldValue = batch.toJSON();
  await batch.update({ student_entry_operator_id: req.body.student_entry_operator_id || null });
  if (oldValue.student_entry_operator_id !== batch.student_entry_operator_id) {
    await logAction(req, {
      action: 'update',
      entityType: 'Batch',
      entityId: batch.id,
      oldValue: { student_entry_operator_id: oldValue.student_entry_operator_id },
      newValue: { student_entry_operator_id: batch.student_entry_operator_id },
    });
  }

  req.setFlash('success', batch.student_entry_operator_id ? 'Data Entry Operator assigned for admissions.' : 'Assignment cleared.');
  res.redirect('/batches' + (req.body.returnQuery || ''));
}

async function destroy(req, res) {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const enrollmentCount = await Enrollment.count({ where: { batch_id: batch.id } });
  if (enrollmentCount > 0) {
    req.setFlash('error', 'Cannot delete a batch with enrollments. Cancel it instead.');
    return res.redirect('/batches');
  }

  await logAction(req, { action: 'delete', entityType: 'Batch', entityId: batch.id, oldValue: batch.toJSON() });
  await batch.destroy();

  req.setFlash('success', 'Batch deleted.');
  res.redirect('/batches');
}

// A scoped Center Coordinator can only export reports for batches at their
// own center(s), and a Data Entry Operator only for batches assigned to
// them — same rule as show().
async function assertBatchExportAllowed(batch, req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds && !centerIds.includes(batch.training_center_id)) {
    res.status(404).render('errors/404', { title: 'Not found' });
    return false;
  }
  const deoBatchIds = await getScopedBatchIdsForDeo(req.currentUser);
  if (deoBatchIds !== null && !deoBatchIds.includes(batch.id)) {
    res.status(404).render('errors/404', { title: 'Not found' });
    return false;
  }
  return true;
}

function safeFilenamePart(text) {
  return String(text || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
}

async function exportJoiningExcel(req, res) {
  const batch = await loadBatchForExport(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });
  if (!(await assertBatchExportAllowed(batch, req, res))) return;

  const buffer = buildJoiningWorkbook(batch, batch.enrollments || []);
  const filename = `Joining-Data-${safeFilenamePart(batch.batch_code)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

async function exportCommencementLetter(req, res) {
  const batch = await loadBatchForExport(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });
  if (!(await assertBatchExportAllowed(batch, req, res))) return;

  const coordinator = batch.trainingCenter && batch.trainingCenter.coordinator
    ? { name: batch.trainingCenter.coordinator.name, email: batch.trainingCenter.coordinator.email }
    : null;

  const buffer = await buildCommencementLetter(batch, batch.enrollments || [], coordinator);
  const filename = `Commencement-Letter-${safeFilenamePart(batch.batch_code)}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

async function exportFeedbackLetter(req, res) {
  const batch = await loadBatchForExport(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });
  if (!(await assertBatchExportAllowed(batch, req, res))) return;

  const coordinator = batch.trainingCenter && batch.trainingCenter.coordinator
    ? { name: batch.trainingCenter.coordinator.name, email: batch.trainingCenter.coordinator.email }
    : null;

  const buffer = await buildFeedbackLetter(batch, batch.enrollments || [], coordinator, req.query.month || '');
  const filename = `Feedback-Letter-${safeFilenamePart(batch.batch_code)}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
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
  assignStudentEntryOperator,
  exportJoiningExcel,
  exportCommencementLetter,
  exportFeedbackLetter,
};
