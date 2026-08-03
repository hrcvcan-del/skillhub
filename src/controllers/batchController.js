const { Batch, Course, TrainingCenter, Trainer, Enrollment, Student } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { generateBatchCode } = require('../utils/batchCode');
const { syncBatchStatus } = require('../utils/batchStatus');

async function loadFormOptions() {
  const [courses, centers, trainers] = await Promise.all([
    Course.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
  ]);
  return { courses, centers, trainers };
}

async function index(req, res) {
  const where = {};
  if (req.query.center_id) where.training_center_id = req.query.center_id;
  if (req.query.status) where.status = req.query.status;

  const total = await Batch.count({ where });
  const pagination = buildPagination(req, total);
  const batches = await Batch.findAll({
    where,
    include: [
      { model: Course, as: 'course' },
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
    ],
    order: [['start_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  await Promise.all(batches.map(syncBatchStatus));

  const { centers } = await loadFormOptions();
  res.render('batches/index', {
    title: 'Batches',
    batches,
    centers,
    filters: { center_id: req.query.center_id || '', status: req.query.status || '' },
    pagination,
  });
}

async function show(req, res) {
  const batch = await Batch.findByPk(req.params.id, {
    include: [
      { model: Course, as: 'course' },
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
      { model: Enrollment, as: 'enrollments', include: [{ model: Student, as: 'student' }] },
    ],
  });
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  await syncBatchStatus(batch);
  const seatsRemaining = batch.capacity - batch.enrollments.filter((e) => e.status === 'active').length;
  res.render('batches/show', { title: batch.batch_code, batch, seatsRemaining });
}

async function newForm(req, res) {
  const options = await loadFormOptions();
  res.render('batches/form', { title: 'New Batch', batch: {}, errors: null, ...options });
}

async function create(req, res) {
  const errors = getErrors(req);
  const options = await loadFormOptions();

  if (errors) {
    return res.status(422).render('batches/form', { title: 'New Batch', batch: req.body, errors, ...options });
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
  });
  await logAction(req, { action: 'create', entityType: 'Batch', entityId: batch.id, newValue: batch.toJSON() });

  req.setFlash('success', `Batch ${batch.batch_code} created.`);
  res.redirect('/batches');
}

async function editForm(req, res) {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });
  const options = await loadFormOptions();
  res.render('batches/form', { title: 'Edit Batch', batch, errors: null, ...options });
}

async function update(req, res) {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  const options = await loadFormOptions();

  if (errors) {
    return res.status(422).render('batches/form', {
      title: 'Edit Batch',
      batch: { ...batch.toJSON(), ...req.body },
      errors,
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
  });
  await logAction(req, { action: 'update', entityType: 'Batch', entityId: batch.id, oldValue, newValue: batch.toJSON() });

  req.setFlash('success', 'Batch updated.');
  res.redirect('/batches');
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

module.exports = { index, show, newForm, create, editForm, update, destroy };
