const { TrainingCenter, Batch, Course, Enrollment, Student } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { checkBatchCapacity, checkDuplicateEnrollment } = require('../utils/enrollmentService');

function backToStep(query) {
  const params = new URLSearchParams();
  ['from_center_id', 'from_batch_id', 'enrollment_id', 'to_center_id'].forEach((key) => {
    if (query[key]) params.set(key, query[key]);
  });
  return `/transfers?${params.toString()}`;
}

async function wizard(req, res) {
  const { from_center_id, from_batch_id, enrollment_id, to_center_id, to_batch_id } = req.query;

  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  let fromCenter = null;
  let fromBatches = [];
  let fromBatch = null;
  let batchStudents = [];
  let enrollment = null;
  let toCenter = null;
  let toBatches = [];
  let toBatch = null;

  if (from_center_id) {
    fromCenter = await TrainingCenter.findByPk(from_center_id);
  }
  if (fromCenter) {
    fromBatches = await Batch.findAll({
      where: { training_center_id: fromCenter.id },
      include: [{ model: Course, as: 'course' }],
      order: [['start_date', 'DESC']],
    });
  }

  if (from_batch_id) {
    fromBatch = await Batch.findByPk(from_batch_id, { include: [{ model: Course, as: 'course' }] });
  }
  if (fromBatch) {
    batchStudents = await Enrollment.findAll({
      where: { batch_id: fromBatch.id, status: 'active' },
      include: [{ model: Student, as: 'student' }],
      order: [[{ model: Student, as: 'student' }, 'name', 'ASC']],
    });
  }

  if (enrollment_id) {
    enrollment = await Enrollment.findByPk(enrollment_id, {
      include: [{ model: Student, as: 'student' }, { model: Batch, as: 'batch' }],
    });
  }

  if (to_center_id) {
    toCenter = await TrainingCenter.findByPk(to_center_id);
  }
  if (toCenter) {
    const rawToBatches = await Batch.findAll({
      where: { training_center_id: toCenter.id, status: ['upcoming', 'ongoing'] },
      include: [{ model: Course, as: 'course' }],
      order: [['start_date', 'DESC']],
    });
    toBatches = enrollment ? rawToBatches.filter((b) => b.id !== enrollment.batch_id) : rawToBatches;
  }

  if (to_batch_id) {
    toBatch = await Batch.findByPk(to_batch_id, { include: [{ model: Course, as: 'course' }] });
  }

  res.render('transfers/wizard', {
    title: 'Batch Transfer',
    errors: null,
    centers,
    fromCenter,
    fromBatches,
    fromBatch,
    batchStudents,
    enrollment,
    toCenter,
    toBatches,
    toBatch,
  });
}

async function transfer(req, res) {
  const errors = getErrors(req);
  if (errors) {
    req.setFlash('error', errors.map((e) => e.message).join(', '));
    return res.redirect(backToStep(req.body));
  }

  const enrollment = await Enrollment.findByPk(req.body.enrollment_id, {
    include: [{ model: Student, as: 'student' }, { model: Batch, as: 'batch' }],
  });
  if (!enrollment) {
    req.setFlash('error', 'Invalid enrollment selected.');
    return res.redirect('/transfers');
  }

  const capacityCheck = await checkBatchCapacity(req.body.to_batch_id, { excludeEnrollmentId: enrollment.id });
  if (!capacityCheck.ok) {
    req.setFlash('error', capacityCheck.message);
    return res.redirect(backToStep(req.body));
  }

  const isDuplicate = await checkDuplicateEnrollment(enrollment.student_id, req.body.to_batch_id, {
    excludeEnrollmentId: enrollment.id,
  });
  if (isDuplicate) {
    req.setFlash('error', 'This student is already enrolled in the destination batch.');
    return res.redirect(backToStep(req.body));
  }

  const oldValue = enrollment.toJSON();
  const fromBatchCode = enrollment.batch.batch_code;
  await enrollment.update({ batch_id: req.body.to_batch_id });

  await logAction(req, {
    action: 'transfer',
    entityType: 'Enrollment',
    entityId: enrollment.id,
    oldValue,
    newValue: enrollment.toJSON(),
  });

  req.setFlash('success', `${enrollment.student.name} transferred from ${fromBatchCode} to ${capacityCheck.batch.batch_code}.`);
  res.redirect(`/batches/${req.body.to_batch_id}`);
}

module.exports = { wizard, transfer };
