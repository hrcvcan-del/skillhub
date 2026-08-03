const { Op } = require('sequelize');
const { Course, Batch } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

function pickFields(body) {
  return {
    name: body.name,
    description: body.description || null,
    category: body.category || null,
    duration_weeks: body.duration_weeks || 1,
    fee_amount: body.fee_amount || 0,
    is_active: body.is_active === 'on' || body.is_active === 'true' || body.is_active === undefined,
  };
}

async function index(req, res) {
  const search = req.query.q || '';
  const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

  const total = await Course.count({ where });
  const pagination = buildPagination(req, total);
  const courses = await Course.findAll({
    where,
    order: [['name', 'ASC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('courses/index', { title: 'Courses', courses, search, pagination });
}

function newForm(req, res) {
  res.render('courses/form', { title: 'New Course', course: {}, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('courses/form', { title: 'New Course', course: req.body, errors });
  }

  const course = await Course.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'Course', entityId: course.id, newValue: course.toJSON() });

  req.setFlash('success', 'Course created.');
  res.redirect('/courses');
}

async function editForm(req, res) {
  const course = await Course.findByPk(req.params.id);
  if (!course) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('courses/form', { title: 'Edit Course', course, errors: null });
}

async function update(req, res) {
  const course = await Course.findByPk(req.params.id);
  if (!course) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('courses/form', {
      title: 'Edit Course',
      course: { ...course.toJSON(), ...req.body },
      errors,
    });
  }

  const oldValue = course.toJSON();
  await course.update({ ...pickFields(req.body), is_active: req.body.is_active === 'on' || req.body.is_active === 'true' });
  await logAction(req, { action: 'update', entityType: 'Course', entityId: course.id, oldValue, newValue: course.toJSON() });

  req.setFlash('success', 'Course updated.');
  res.redirect('/courses');
}

async function destroy(req, res) {
  const course = await Course.findByPk(req.params.id);
  if (!course) return res.status(404).render('errors/404', { title: 'Not found' });

  const batchCount = await Batch.count({ where: { course_id: course.id } });
  if (batchCount > 0) {
    req.setFlash('error', 'Cannot delete a course that has batches. Deactivate it instead.');
    return res.redirect('/courses');
  }

  await logAction(req, { action: 'delete', entityType: 'Course', entityId: course.id, oldValue: course.toJSON() });
  await course.destroy();

  req.setFlash('success', 'Course deleted.');
  res.redirect('/courses');
}

module.exports = { index, newForm, create, editForm, update, destroy };
