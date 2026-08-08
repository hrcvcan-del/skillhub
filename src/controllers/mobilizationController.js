const { MobilizationForm, DailyAdmissionCount, TrainingCenter, Trainer, User } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { getScopedCenterIds, centerIdsWhereValue } = require('../utils/centerScope');

async function loadFormOptions(currentUser) {
  const scopedCenterIds = await getScopedCenterIds(currentUser);
  const centerWhere = { is_active: true };
  if (scopedCenterIds) centerWhere.id = centerIdsWhereValue(scopedCenterIds);

  const [centers, trainers, coordinators] = await Promise.all([
    TrainingCenter.findAll({ where: centerWhere, order: [['name', 'ASC']] }),
    Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    User.findAll({ where: { role: 'center_coordinator', is_active: true }, order: [['name', 'ASC']] }),
  ]);
  return { centers, trainers, coordinators };
}

async function index(req, res) {
  const scopedCenterIds = await getScopedCenterIds(req.currentUser);
  const where = {};
  if (scopedCenterIds) where.training_center_id = centerIdsWhereValue(scopedCenterIds);
  if (req.query.training_center_id) where.training_center_id = req.query.training_center_id;
  if (req.query.trainer_id) where.trainer_id = req.query.trainer_id;
  if (req.query.center_coordinator_id) where.center_coordinator_id = req.query.center_coordinator_id;
  if (req.query.status) where.status = req.query.status;

  const total = await MobilizationForm.count({ where });
  const pagination = buildPagination(req, total);
  const entries = await MobilizationForm.findAll({
    where,
    include: [
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
      { model: User, as: 'centerCoordinator' },
    ],
    order: [['form_date', 'DESC'], ['id', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const options = await loadFormOptions(req.currentUser);
  const canReview = ['admin', 'director', 'manager', 'scheme_manager', 'master_admin'].includes(req.currentUser.role);

  const totals = await MobilizationForm.findAll({ where, attributes: ['forms_submitted_count', 'forms_accepted_count'] });
  const totalSubmitted = totals.reduce((sum, t) => sum + Number(t.forms_submitted_count || 0), 0);
  const totalAccepted = totals.reduce((sum, t) => sum + Number(t.forms_accepted_count || 0), 0);

  res.render('mobilization/index', {
    title: 'Mobilization — Admission Forms',
    entries,
    ...options,
    canReview,
    totalSubmitted,
    totalAccepted,
    filters: {
      training_center_id: req.query.training_center_id || '',
      trainer_id: req.query.trainer_id || '',
      center_coordinator_id: req.query.center_coordinator_id || '',
      status: req.query.status || '',
    },
    pagination,
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function newForm(req, res) {
  const options = await loadFormOptions(req.currentUser);
  const defaultCoordinatorId = req.currentUser.role === 'center_coordinator' ? req.currentUser.id : '';
  res.render('mobilization/form', {
    title: 'Log Admission Forms',
    entry: { form_date: todayISO(), center_coordinator_id: defaultCoordinatorId },
    errors: null,
    ...options,
  });
}

async function create(req, res) {
  const errors = getErrors(req);
  const options = await loadFormOptions(req.currentUser);

  if (errors) {
    return res.status(422).render('mobilization/form', { title: 'Log Admission Forms', entry: req.body, errors, ...options });
  }

  // A center_coordinator can only log against a center they're scoped to
  // — re-check server-side rather than trusting the (already filtered)
  // dropdown, the same defense-in-depth used elsewhere for this scoping.
  const scopedCenterIds = await getScopedCenterIds(req.currentUser);
  if (scopedCenterIds && !scopedCenterIds.includes(Number(req.body.training_center_id))) {
    req.setFlash('error', 'You can only log admission forms for your own center.');
    return res.status(403).render('mobilization/form', { title: 'Log Admission Forms', entry: req.body, errors: null, ...options });
  }

  const entry = await MobilizationForm.create({
    training_center_id: req.body.training_center_id,
    trainer_id: req.body.trainer_id,
    center_coordinator_id: req.body.center_coordinator_id,
    form_date: req.body.form_date,
    forms_submitted_count: req.body.forms_submitted_count,
    status: 'pending',
    recorded_by: req.currentUser.id,
    remarks: req.body.remarks || null,
  });
  await logAction(req, { action: 'create', entityType: 'MobilizationForm', entityId: entry.id, newValue: entry.toJSON() });

  req.setFlash('success', 'Admission form count logged.');
  res.redirect('/mobilization');
}

async function reviewForm(req, res) {
  const entry = await MobilizationForm.findByPk(req.params.id, {
    include: [
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
      { model: User, as: 'centerCoordinator' },
    ],
  });
  if (!entry) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('mobilization/review', { title: 'Review Admission Forms', entry, errors: null });
}

async function review(req, res) {
  const entry = await MobilizationForm.findByPk(req.params.id);
  if (!entry) return res.status(404).render('errors/404', { title: 'Not found' });

  const submitted = req.body.forms_submitted_count !== undefined && req.body.forms_submitted_count !== ''
    ? parseInt(req.body.forms_submitted_count, 10)
    : entry.forms_submitted_count;
  const accepted = parseInt(req.body.forms_accepted_count, 10);

  if (!Number.isFinite(accepted) || accepted < 0) {
    req.setFlash('error', 'Enter a valid accepted count.');
    return res.redirect(`/mobilization/${entry.id}/review`);
  }
  if (accepted > submitted) {
    req.setFlash('error', `Accepted count can't be more than the submitted count (${submitted}).`);
    return res.redirect(`/mobilization/${entry.id}/review`);
  }

  const oldValue = entry.toJSON();
  await entry.update({
    forms_submitted_count: submitted,
    forms_accepted_count: accepted,
    status: 'reviewed',
    reviewed_by: req.currentUser.id,
    reviewed_at: new Date(),
    remarks: req.body.remarks || entry.remarks,
  });
  await logAction(req, { action: 'review', entityType: 'MobilizationForm', entityId: entry.id, oldValue, newValue: entry.toJSON() });

  req.setFlash('success', 'Reviewed — accepted count recorded.');
  res.redirect('/mobilization');
}

// GET /mobilization/daily — every logged daily-admission-count entry,
// filterable, with a per-(trainer, center) running total so a mobilizer
// can see cumulative admissions without adding up rows by hand.
async function dailyIndex(req, res) {
  const scopedCenterIds = await getScopedCenterIds(req.currentUser);
  const where = {};
  if (scopedCenterIds) where.training_center_id = centerIdsWhereValue(scopedCenterIds);
  if (req.query.training_center_id) where.training_center_id = req.query.training_center_id;
  if (req.query.trainer_id) where.trainer_id = req.query.trainer_id;

  const total = await DailyAdmissionCount.count({ where });
  const pagination = buildPagination(req, total);
  const entries = await DailyAdmissionCount.findAll({
    where,
    include: [
      { model: TrainingCenter, as: 'trainingCenter' },
      { model: Trainer, as: 'trainer' },
      { model: User, as: 'recordedByUser' },
    ],
    order: [['count_date', 'DESC'], ['id', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const options = await loadFormOptions(req.currentUser);

  res.render('mobilization/daily/index', {
    title: 'Daily Admission Count',
    entries,
    centers: options.centers,
    trainers: options.trainers,
    filters: {
      training_center_id: req.query.training_center_id || '',
      trainer_id: req.query.trainer_id || '',
    },
    pagination,
  });
}

async function dailyForm(req, res) {
  const options = await loadFormOptions(req.currentUser);
  res.render('mobilization/daily/form', {
    title: 'Log Daily Admission Count',
    entry: { count_date: todayISO() },
    errors: null,
    centers: options.centers,
    trainers: options.trainers,
  });
}

// POST /mobilization/daily — upserts by (center, trainer, date): calling
// the same trainer again the same day updates that day's count instead
// of creating a duplicate row, per "we can modify daily admission count".
async function dailySave(req, res) {
  const errors = getErrors(req);
  const options = await loadFormOptions(req.currentUser);
  if (errors) {
    return res.status(422).render('mobilization/daily/form', {
      title: 'Log Daily Admission Count',
      entry: req.body,
      errors,
      centers: options.centers,
      trainers: options.trainers,
    });
  }

  const scopedCenterIds = await getScopedCenterIds(req.currentUser);
  if (scopedCenterIds && !scopedCenterIds.includes(Number(req.body.training_center_id))) {
    req.setFlash('error', 'You can only log admissions for your own center.');
    return res.status(403).render('mobilization/daily/form', {
      title: 'Log Daily Admission Count',
      entry: req.body,
      errors: null,
      centers: options.centers,
      trainers: options.trainers,
    });
  }

  const [entry] = await DailyAdmissionCount.findOrCreate({
    where: {
      training_center_id: req.body.training_center_id,
      trainer_id: req.body.trainer_id,
      count_date: req.body.count_date,
    },
    defaults: {
      training_center_id: req.body.training_center_id,
      trainer_id: req.body.trainer_id,
      count_date: req.body.count_date,
      admissions_count: req.body.admissions_count,
      recorded_by: req.currentUser.id,
      remarks: req.body.remarks || null,
    },
  });

  const oldValue = entry.toJSON();
  await entry.update({
    admissions_count: req.body.admissions_count,
    recorded_by: req.currentUser.id,
    remarks: req.body.remarks || entry.remarks,
  });
  if (oldValue.admissions_count !== entry.admissions_count) {
    await logAction(req, {
      action: 'update',
      entityType: 'DailyAdmissionCount',
      entityId: entry.id,
      oldValue,
      newValue: entry.toJSON(),
    });
  }

  req.setFlash('success', `Logged ${req.body.admissions_count} admission(s) for ${req.body.count_date}.`);
  res.redirect('/mobilization/daily');
}

// GET /mobilization/summary — the "how much form towards madam" report:
// per (trainer, center), total admissions the trainer has reported by
// phone vs how many forms were actually collected vs how many were
// accepted, so a gap makes it obvious how many forms are still sitting
// with the trainer.
async function summary(req, res) {
  const scopedCenterIds = await getScopedCenterIds(req.currentUser);
  const centerWhere = {};
  if (scopedCenterIds) centerWhere.training_center_id = centerIdsWhereValue(scopedCenterIds);

  const [dailyCounts, forms] = await Promise.all([
    DailyAdmissionCount.findAll({
      where: centerWhere,
      include: [{ model: TrainingCenter, as: 'trainingCenter' }, { model: Trainer, as: 'trainer' }],
    }),
    MobilizationForm.findAll({
      where: centerWhere,
      include: [{ model: TrainingCenter, as: 'trainingCenter' }, { model: Trainer, as: 'trainer' }],
    }),
  ]);

  const buckets = new Map(); // "centerId:trainerId" -> row
  const bucketFor = (centerId, trainerId, center, trainer) => {
    const key = `${centerId}:${trainerId}`;
    if (!buckets.has(key)) {
      buckets.set(key, { center, trainer, totalAdmissions: 0, totalSubmitted: 0, totalAccepted: 0 });
    }
    return buckets.get(key);
  };

  dailyCounts.forEach((d) => {
    const bucket = bucketFor(d.training_center_id, d.trainer_id, d.trainingCenter, d.trainer);
    bucket.totalAdmissions += Number(d.admissions_count);
  });
  forms.forEach((f) => {
    const bucket = bucketFor(f.training_center_id, f.trainer_id, f.trainingCenter, f.trainer);
    bucket.totalSubmitted += Number(f.forms_submitted_count);
    bucket.totalAccepted += Number(f.forms_accepted_count || 0);
  });

  const rows = Array.from(buckets.values())
    .map((b) => ({ ...b, pendingWithTrainer: Math.max(b.totalAdmissions - b.totalSubmitted, 0) }))
    .sort((a, b) => b.pendingWithTrainer - a.pendingWithTrainer);

  res.render('mobilization/summary', { title: 'Mobilization Summary', rows });
}

module.exports = { index, newForm, create, reviewForm, review, dailyIndex, dailyForm, dailySave, summary };
