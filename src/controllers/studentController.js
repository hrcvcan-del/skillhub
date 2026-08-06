const { Op } = require('sequelize');
const sequelize = require('../config/db');
const { Student, Enrollment, Batch, Course, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { checkBatchCapacity, createEnrollment } = require('../utils/enrollmentService');
const { getScopedCenterIds, getStudentIdsAtCenters, centerIdsWhereValue, NO_MATCH_ID } = require('../utils/centerScope');

// Wraps the shared helper with the "null = unrestricted" convention the
// rest of this controller uses.
async function scopedStudentIds(centerIds) {
  if (!centerIds) return null;
  return getStudentIdsAtCenters(centerIds);
}

function pickFields(body) {
  return {
    name: body.name,
    middle_name: body.middle_name || null,
    full_name: body.full_name || null,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    date_of_birth: body.date_of_birth || null,
    gender: body.gender || null,
    education: body.education || null,
    caste_category: body.caste_category || null,
    guardian_name: body.guardian_name || null,
    guardian_phone: body.guardian_phone || null,
    id_proof_number: body.id_proof_number || null,
    aadhaar_number: body.aadhaar_number || null,
    taluka: body.taluka || null,
    district: body.district || null,
  };
}

async function batchesForCenter(centerId) {
  return Batch.findAll({
    where: { training_center_id: centerId, status: ['upcoming', 'ongoing'] },
    include: [{ model: Course, as: 'course' }],
    order: [['start_date', 'DESC']],
  });
}

async function index(req, res) {
  const search = req.query.q || '';
  const where = search
    ? {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};

  const centerIds = await getScopedCenterIds(req.currentUser);
  const studentIds = await scopedStudentIds(centerIds);
  if (studentIds !== null) where.id = studentIds.length === 0 ? NO_MATCH_ID : studentIds;

  const total = await Student.count({ where });
  const pagination = buildPagination(req, total);
  const students = await Student.findAll({
    where,
    order: [['name', 'ASC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('students/index', { title: 'Students', students, search, pagination });
}

async function show(req, res) {
  const student = await Student.findByPk(req.params.id, {
    include: [
      {
        model: Enrollment,
        as: 'enrollments',
        include: [{ model: Batch, as: 'batch', include: [{ model: Course, as: 'course' }] }],
      },
    ],
  });
  if (!student) return res.status(404).render('errors/404', { title: 'Not found' });

  const centerIds = await getScopedCenterIds(req.currentUser);
  if (centerIds) {
    const atOwnCenter = student.enrollments.some((e) => e.batch && centerIds.includes(e.batch.training_center_id));
    if (!atOwnCenter) return res.status(404).render('errors/404', { title: 'Not found' });
  }

  res.render('students/show', { title: student.name, student });
}

// Add Student is a gated flow: a center must be chosen before a batch can be
// picked, and a batch before the rest of the form appears, matching how
// admissions actually happen (a candidate is always joining a specific batch
// at a specific center from day one).
async function newForm(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds), is_active: true } : { is_active: true };
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });

  if (!req.query.center_id) {
    return res.render('students/select-center', { title: 'Add Student', centers, selectedCenterId: '' });
  }

  const center = await TrainingCenter.findByPk(req.query.center_id);
  if (!center || (centerIds && !centerIds.includes(center.id))) {
    req.setFlash('error', 'Please select a valid center.');
    return res.redirect('/students/new');
  }

  const batches = await batchesForCenter(center.id);

  res.render('students/form', {
    title: 'Add Student',
    student: {},
    errors: null,
    center,
    centers,
    batches,
    preselectBatchId: req.query.batch_id || '',
  });
}

async function create(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const center = req.body.center_id ? await TrainingCenter.findByPk(req.body.center_id) : null;
  const centerWhere = centerIds ? { id: centerIdsWhereValue(centerIds), is_active: true } : { is_active: true };
  const centers = await TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] });
  const batches = center ? await batchesForCenter(center.id) : [];

  const rerender = (formErrors) =>
    res.status(422).render('students/form', {
      title: 'Add Student',
      student: req.body,
      errors: formErrors,
      center,
      centers,
      batches,
      preselectBatchId: req.body.batch_id,
    });

  if (!center || (centerIds && !centerIds.includes(center.id))) {
    return rerender([{ field: 'center_id', message: 'Please select a valid center' }]);
  }

  const errors = getErrors(req);
  if (errors) return rerender(errors);

  const capacityCheck = await checkBatchCapacity(req.body.batch_id);
  if (!capacityCheck.ok) {
    return rerender([{ field: 'batch_id', message: capacityCheck.message }]);
  }

  const transaction = await sequelize.transaction();
  let student;
  let enrollment;
  try {
    student = await Student.create(pickFields(req.body), { transaction });
    enrollment = await createEnrollment({
      studentId: student.id,
      batchId: req.body.batch_id,
      enrollmentDate: req.body.enrollment_date,
      totalFee: req.body.total_fee,
      discount: req.body.discount_amount,
      feePaid: req.body.fee_paid,
      paymentMode: req.body.payment_mode,
      recordedByUserId: req.currentUser.id,
      transaction,
    });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await logAction(req, { action: 'create', entityType: 'Student', entityId: student.id, newValue: student.toJSON() });
  await logAction(req, { action: 'create', entityType: 'Enrollment', entityId: enrollment.id, newValue: enrollment.toJSON() });

  req.setFlash('success', `${student.name} added and enrolled in ${capacityCheck.batch.batch_code}.`);
  res.redirect(`/students/${student.id}`);
}

// Shared ownership guard for edit/update: re-derives which students a scoped
// Center Coordinator can touch via their enrollments, same rule as `show`.
async function assertStudentInScope(studentId, req) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  if (!centerIds) return true;
  const ids = await scopedStudentIds(centerIds);
  return ids.includes(studentId);
}

async function editForm(req, res) {
  const student = await Student.findByPk(req.params.id);
  if (!student) return res.status(404).render('errors/404', { title: 'Not found' });
  if (!(await assertStudentInScope(student.id, req))) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }
  res.render('students/edit', { title: 'Edit Student', student, errors: null });
}

async function update(req, res) {
  const student = await Student.findByPk(req.params.id);
  if (!student) return res.status(404).render('errors/404', { title: 'Not found' });
  if (!(await assertStudentInScope(student.id, req))) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('students/edit', {
      title: 'Edit Student',
      student: { ...student.toJSON(), ...req.body },
      errors,
    });
  }

  const oldValue = student.toJSON();
  await student.update(pickFields(req.body));
  await logAction(req, { action: 'update', entityType: 'Student', entityId: student.id, oldValue, newValue: student.toJSON() });

  req.setFlash('success', 'Student updated.');
  res.redirect('/students');
}

async function destroy(req, res) {
  const student = await Student.findByPk(req.params.id);
  if (!student) return res.status(404).render('errors/404', { title: 'Not found' });

  await logAction(req, { action: 'delete', entityType: 'Student', entityId: student.id, oldValue: student.toJSON() });
  await student.destroy();

  req.setFlash('success', 'Student deleted.');
  res.redirect('/students');
}

module.exports = { index, show, newForm, create, editForm, update, destroy };
