const { Enrollment, Student, Batch, Course, FeePayment } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');

function computeFeeDue(totalFee, discount, feePaid) {
  const due = Number(totalFee) - Number(discount) - Number(feePaid);
  return due > 0 ? due : 0;
}

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

  if (errors) {
    return res.status(422).render('enrollments/form', {
      title: 'New Enrollment',
      enrollment: req.body,
      errors,
      students,
      batches,
      preselectStudentId: req.body.student_id,
      preselectBatchId: req.body.batch_id,
    });
  }

  const batch = await Batch.findByPk(req.body.batch_id);
  if (!batch) {
    return res.status(422).render('enrollments/form', {
      title: 'New Enrollment',
      enrollment: req.body,
      errors: [{ field: 'batch_id', message: 'Invalid batch' }],
      students,
      batches,
      preselectStudentId: req.body.student_id,
      preselectBatchId: req.body.batch_id,
    });
  }

  const activeCount = await Enrollment.count({ where: { batch_id: batch.id, status: 'active' } });
  if (activeCount >= batch.capacity) {
    return res.status(422).render('enrollments/form', {
      title: 'New Enrollment',
      enrollment: req.body,
      errors: [{ field: 'batch_id', message: 'This batch is already at full capacity' }],
      students,
      batches,
      preselectStudentId: req.body.student_id,
      preselectBatchId: req.body.batch_id,
    });
  }

  const duplicate = await Enrollment.findOne({
    where: { batch_id: batch.id, student_id: req.body.student_id, status: 'active' },
  });
  if (duplicate) {
    return res.status(422).render('enrollments/form', {
      title: 'New Enrollment',
      enrollment: req.body,
      errors: [{ field: 'student_id', message: 'This student is already actively enrolled in this batch' }],
      students,
      batches,
      preselectStudentId: req.body.student_id,
      preselectBatchId: req.body.batch_id,
    });
  }

  const totalFee = req.body.total_fee || 0;
  const discount = req.body.discount_amount || 0;
  const feePaidAtEnrollment = req.body.fee_paid || 0;
  const feeDue = computeFeeDue(totalFee, discount, feePaidAtEnrollment);

  const enrollment = await Enrollment.create({
    student_id: req.body.student_id,
    batch_id: req.body.batch_id,
    enrollment_date: req.body.enrollment_date || new Date().toISOString().slice(0, 10),
    total_fee: totalFee,
    discount_amount: discount,
    fee_paid: feePaidAtEnrollment,
    fee_due: feeDue,
    status: 'active',
  });

  if (Number(feePaidAtEnrollment) > 0) {
    await FeePayment.create({
      enrollment_id: enrollment.id,
      amount: feePaidAtEnrollment,
      payment_date: req.body.enrollment_date || new Date().toISOString().slice(0, 10),
      payment_mode: req.body.payment_mode || 'cash',
      recorded_by: req.currentUser.id,
    });
  }

  await logAction(req, { action: 'create', entityType: 'Enrollment', entityId: enrollment.id, newValue: enrollment.toJSON() });

  req.setFlash('success', 'Student enrolled.');
  res.redirect(`/batches/${batch.id}`);
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
