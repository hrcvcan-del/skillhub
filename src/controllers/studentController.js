const { Op } = require('sequelize');
const { Student, Enrollment, Batch, Course } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

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
  res.render('students/show', { title: student.name, student });
}

function newForm(req, res) {
  res.render('students/form', { title: 'New Student', student: {}, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('students/form', { title: 'New Student', student: req.body, errors });
  }

  const student = await Student.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'Student', entityId: student.id, newValue: student.toJSON() });

  req.setFlash('success', 'Student added.');
  res.redirect('/students');
}

async function editForm(req, res) {
  const student = await Student.findByPk(req.params.id);
  if (!student) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('students/form', { title: 'Edit Student', student, errors: null });
}

async function update(req, res) {
  const student = await Student.findByPk(req.params.id);
  if (!student) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('students/form', {
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
