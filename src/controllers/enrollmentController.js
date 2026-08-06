const { Enrollment, Student, Batch, Course, FeePayment } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const {
  computeFeeDue,
  checkBatchCapacity,
  checkDuplicateEnrollment,
  createEnrollment,
} = require('../utils/enrollmentService');

async function newForm(req, res) {
  const [students, batches] = await Promise.all([
    Student.findAll({ order: [['name', 'ASC']] }),
    Batch.findAll({
      where: { status: ['upcoming', 'ongoing'] },
      include: [{ model: Course, as: 'course' }],
      order: [['start_date', 'DESC']],
    }),
  ]);

  res.render('enrollments/form', {
    title: 'New Enrollment',
    enrollment: {},
    errors: null,
    students,
    batches,
    preselectStudentId: req.query.student_id || '',
    preselectBatchId: req.query.batch_id || '',
  });
}

async function create(req, res) {
  const errors = getErrors(req);
  const [students, batches] = await Promise.all([
    Student.findAll({ order: [['name', 'ASC']] }),
    Batch.findAll({ where: { status: ['upcoming', 'ongoing'] }, include: [{ model: Course, as: 'course' }] }),
  ]);

  const rerender = (formErrors) =>
    res.status(422).render('enrollments/form', {
      title: 'New Enrollment',
      enrollment: req.body,
      errors: formErrors,
      students,
      batches,
      preselectStudentId: req.body.student_id,
      preselectBatchId: req.body.batch_id,
    });

  if (errors) return rerender(errors);

  const capacityCheck = await checkBatchCapacity(req.body.batch_id);
  if (!capacityCheck.ok) {
    return rerender([{ field: 'batch_id', message: capacityCheck.message }]);
  }

  const isDuplicate = await checkDuplicateEnrollment(req.body.student_id, req.body.batch_id);
  if (isDuplicate) {
    return rerender([{ field: 'student_id', message: 'This student is already actively enrolled in this batch' }]);
  }

  const enrollment = await createEnrollment({
    studentId: req.body.student_id,
    batchId: req.body.batch_id,
    enrollmentDate: req.body.enrollment_date,
    totalFee: req.body.total_fee,
    discount: req.body.discount_amount,
    feePaid: req.body.fee_paid,
    paymentMode: req.body.payment_mode,
    recordedByUserId: req.currentUser.id,
  });

  await logAction(req, { action: 'create', entityType: 'Enrollment', entityId: enrollment.id, newValue: enrollment.toJSON() });

  req.setFlash('success', 'Student enrolled.');
  res.redirect(`/batches/${capacityCheck.batch.id}`);
}

async function show(req, res) {
  const enrollment = await Enrollment.findByPk(req.params.id, {
    include: [
      { model: Student, as: 'student' },
      { model: Batch, as: 'batch', include: [{ model: Course, as: 'course' }] },
      { model: FeePayment, as: 'feePayments' },
    ],
  });
  if (!enrollment) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('enrollments/show', { title: `Enrollment #${enrollment.id}`, enrollment });
}

async function editForm(req, res) {
  const enrollment = await Enrollment.findByPk(req.params.id, {
    include: [{ model: Student, as: 'student' }, { model: Batch, as: 'batch' }],
  });
  if (!enrollment) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('enrollments/edit', { title: 'Edit Enrollment', enrollment, errors: null });
}

async function update(req, res) {
  const enrollment = await Enrollment.findByPk(req.params.id);
  if (!enrollment) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    const full = await Enrollment.findByPk(req.params.id, {
      include: [{ model: Student, as: 'student' }, { model: Batch, as: 'batch' }],
    });
    return res.status(422).render('enrollments/edit', { title: 'Edit Enrollment', enrollment: full, errors });
  }

  const oldValue = enrollment.toJSON();
  const totalFee = req.body.total_fee;
  const discount = req.body.discount_amount || 0;
  const feeDue = computeFeeDue(totalFee, discount, enrollment.fee_paid);

  await enrollment.update({
    total_fee: totalFee,
    discount_amount: discount,
    fee_due: feeDue,
    status: req.body.status,
  });

  await logAction(req, { action: 'update', entityType: 'Enrollment', entityId: enrollment.id, oldValue, newValue: enrollment.toJSON() });

  req.setFlash('success', 'Enrollment updated.');
  res.redirect(`/enrollments/${enrollment.id}`);
}

module.exports = { newForm, create, show, editForm, update };
