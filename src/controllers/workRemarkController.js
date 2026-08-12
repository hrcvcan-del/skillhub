const { Op } = require('sequelize');
const { WorkRemark, User } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { WORK_REMARK_TYPES } = require('../utils/workRemarkTypes');
const { WORK_REMARK_LOG_ROLES } = require('../utils/roles');
const { sendCsv } = require('../utils/csv');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// GET /work-remarks/me — self-service: log today's (or any past day's)
// work and see your own history. Open to any authenticated user (same
// "no special role needed to mark your own" pattern as staff attendance
// clock-in/out), even though the nav link only surfaces it for
// WORK_REMARK_LOG_ROLES.
async function myIndex(req, res) {
  const total = await WorkRemark.count({ where: { user_id: req.currentUser.id } });
  const pagination = buildPagination(req, total, 20);
  const remarks = await WorkRemark.findAll({
    where: { user_id: req.currentUser.id },
    order: [['remark_date', 'DESC'], ['id', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  res.render('workRemarks/me', {
    title: 'My Work Remarks',
    remarks,
    workTypes: WORK_REMARK_TYPES,
    today: todayISO(),
    errors: null,
    formValues: { remark_date: todayISO(), work_type: '', remark: '' },
    pagination,
  });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    const total = await WorkRemark.count({ where: { user_id: req.currentUser.id } });
    const pagination = buildPagination(req, total, 20);
    const remarks = await WorkRemark.findAll({
      where: { user_id: req.currentUser.id },
      order: [['remark_date', 'DESC'], ['id', 'DESC']],
      limit: pagination.pageSize,
      offset: pagination.offset,
    });
    return res.status(422).render('workRemarks/me', {
      title: 'My Work Remarks',
      remarks,
      workTypes: WORK_REMARK_TYPES,
      today: todayISO(),
      errors,
      formValues: req.body,
      pagination,
    });
  }

  const remark = await WorkRemark.create({
    user_id: req.currentUser.id,
    remark_date: req.body.remark_date,
    work_type: req.body.work_type,
    remark: req.body.remark || null,
  });
  await logAction(req, { action: 'create', entityType: 'WorkRemark', entityId: remark.id, newValue: remark.toJSON() });

  req.setFlash('success', 'Work remark logged.');
  res.redirect('/work-remarks/me');
}

// A user may only delete their own entries — an admin correcting/removing
// someone else's goes through the monitoring view instead (destroyAny).
async function destroySelf(req, res) {
  const remark = await WorkRemark.findOne({ where: { id: req.params.id, user_id: req.currentUser.id } });
  if (!remark) return res.status(404).render('errors/404', { title: 'Not found' });

  await logAction(req, { action: 'delete', entityType: 'WorkRemark', entityId: remark.id, oldValue: remark.toJSON() });
  await remark.destroy();

  req.setFlash('success', 'Work remark deleted.');
  res.redirect('/work-remarks/me');
}

async function loadMonitorFilters() {
  return User.findAll({
    where: { role: WORK_REMARK_LOG_ROLES, is_active: true },
    order: [['name', 'ASC']],
  });
}

function buildMonitorWhere(query) {
  const where = {};
  if (query.user_id) where.user_id = query.user_id;
  if (query.date_from || query.date_to) {
    where.remark_date = {};
    if (query.date_from) where.remark_date[Op.gte] = query.date_from;
    if (query.date_to) where.remark_date[Op.lte] = query.date_to;
  }
  return where;
}

// GET /work-remarks/monitor — admin/director oversight: every logged
// entry across every coordinator/DEO, filterable by person and date
// range, so their day-to-day work is visible without having to ask them.
async function monitor(req, res) {
  const where = buildMonitorWhere(req.query);
  const total = await WorkRemark.count({ where });
  const pagination = buildPagination(req, total, 30);
  const remarks = await WorkRemark.findAll({
    where,
    include: [{ model: User, as: 'user' }],
    order: [['remark_date', 'DESC'], ['id', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const users = await loadMonitorFilters();

  res.render('workRemarks/monitor', {
    title: 'Work Remarks — Monitoring',
    remarks,
    users,
    filters: {
      user_id: req.query.user_id || '',
      date_from: req.query.date_from || '',
      date_to: req.query.date_to || '',
    },
    pagination,
  });
}

async function monitorExport(req, res) {
  const where = buildMonitorWhere(req.query);
  const remarks = await WorkRemark.findAll({
    where,
    include: [{ model: User, as: 'user' }],
    order: [['remark_date', 'DESC'], ['id', 'DESC']],
  });

  sendCsv(res, 'work-remarks.csv', remarks, [
    { label: 'Date', value: (r) => r.remark_date },
    { label: 'Name', value: (r) => (r.user ? r.user.name : '') },
    { label: 'Role', value: (r) => (r.user ? r.user.role : '') },
    { label: 'Work Type', value: (r) => r.work_type },
    { label: 'Remark', value: (r) => r.remark || '' },
  ]);
}

module.exports = { myIndex, create, destroySelf, monitor, monitorExport };
