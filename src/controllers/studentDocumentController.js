const { Op } = require('sequelize');
const {
  StudentDocument,
  Student,
  Enrollment,
  Batch,
  Course,
  TrainingCenter,
  SchemePhase,
  Scheme,
  User,
} = require('../models');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');
const { DOCUMENT_TYPES, DOCUMENT_TYPE_KEYS } = require('../utils/documentTypes');
const { buildMissingDocumentsWorkbook } = require('../utils/missingDocumentsReport');

// Batch picker: one row per batch that has at least one actively-enrolled
// student, with a live pending-documents count so an operator can see at a
// glance which batches still need checking.
async function batchList(req, res) {
  const search = req.query.q || '';
  const where = search ? { batch_code: { [Op.iLike]: `%${search}%` } } : {};

  const total = await Batch.count({ where });
  const pagination = buildPagination(req, total);
  const batches = await Batch.findAll({
    where,
    include: [
      { model: Course, as: 'course' },
      { model: TrainingCenter, as: 'trainingCenter' },
      {
        model: Enrollment,
        as: 'enrollments',
        where: { status: 'active' },
        required: false,
        attributes: ['id', 'student_id'],
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id'],
            include: [{ model: StudentDocument, as: 'documents', attributes: ['id', 'status'] }],
          },
        ],
      },
    ],
    order: [['start_date', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const rows = batches.map((batch) => {
    const activeStudents = batch.enrollments.length;
    let pending = 0;
    batch.enrollments.forEach((e) => {
      const docs = e.student ? e.student.documents : [];
      if (docs.some((d) => d.status !== 'submitted')) pending += 1;
    });
    return { batch, activeStudents, pending };
  });

  res.render('studentDocuments/batchList', { title: 'Document Verification', rows, search, pagination });
}

// The checklist page for one batch: every actively-enrolled student with
// their 5-document status, editable in one form.
async function showBatch(req, res) {
  const batch = await Batch.findByPk(req.params.batchId, {
    include: [
      { model: Course, as: 'course' },
      { model: TrainingCenter, as: 'trainingCenter' },
    ],
  });
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const enrollments = await Enrollment.findAll({
    where: { batch_id: batch.id, status: 'active' },
    include: [
      {
        model: Student,
        as: 'student',
        include: [
          {
            model: StudentDocument,
            as: 'documents',
            include: [{ model: User, as: 'verifier', attributes: ['id', 'name'] }],
          },
        ],
      },
    ],
    order: [['enrollment_date', 'ASC']],
  });

  res.render('studentDocuments/batchShow', {
    title: `Document Verification - ${batch.batch_code}`,
    batch,
    enrollments,
    documentTypes: DOCUMENT_TYPES,
  });
}

// Saves the whole batch's checklist in one submit. Every actively-enrolled
// student rendered on the form gets their 5 rows set to submitted/
// not_submitted based on which checkboxes came back checked, and is
// stamped as checked-by-this-operator-now regardless of whether the
// status changed — "did they look at the file today" is what the
// monitoring report needs, not just "did the status flip".
async function updateBatch(req, res) {
  const batch = await Batch.findByPk(req.params.batchId);
  if (!batch) return res.status(404).render('errors/404', { title: 'Not found' });

  const enrollments = await Enrollment.findAll({
    where: { batch_id: batch.id, status: 'active' },
    include: [{ model: Student, as: 'student', include: [{ model: StudentDocument, as: 'documents' }] }],
  });

  const submitted = req.body.documents || {};
  const now = new Date();

  for (const enrollment of enrollments) {
    const student = enrollment.student;
    // Keyed "s<id>" rather than the bare numeric id — express-urlencoded's
    // qs parser silently treats an all-numeric bracket key as an array
    // index rather than an object key, which drops the data for any
    // student id under qs's arrayLimit.
    const studentInput = submitted[`s${student.id}`] || {};

    for (const docType of DOCUMENT_TYPE_KEYS) {
      const doc = student.documents.find((d) => d.document_type === docType);
      if (!doc) continue; // eslint-disable-line no-continue -- shouldn't happen, ensureStudentDocuments guarantees all 5

      const newStatus = studentInput[docType] ? 'submitted' : 'not_submitted';
      const oldValue = doc.toJSON();

      // eslint-disable-next-line no-await-in-loop
      await doc.update({ status: newStatus, verified_by: req.currentUser.id, verified_at: now });

      if (oldValue.status !== newStatus) {
        // eslint-disable-next-line no-await-in-loop
        await logAction(req, {
          action: 'update',
          entityType: 'StudentDocument',
          entityId: doc.id,
          oldValue,
          newValue: doc.toJSON(),
        });
      }
    }
  }

  req.setFlash('success', `Document checklist saved for ${enrollments.length} student(s).`);
  res.redirect(`/documents/batches/${batch.id}`);
}

async function loadReportFilterOptions() {
  const [centers, phases] = await Promise.all([
    TrainingCenter.findAll({ order: [['name', 'ASC']] }),
    SchemePhase.findAll({ include: [{ model: Scheme, as: 'scheme' }], order: [['name', 'ASC']] }),
  ]);
  return { centers, phases };
}

function buildMissingRows(enrollments) {
  return enrollments
    .map((enrollment) => {
      const student = enrollment.student;
      const docs = student.documents || [];
      const submittedCount = docs.filter((d) => d.status === 'submitted').length;
      const missing = docs.filter((d) => d.status !== 'submitted');
      if (missing.length === 0) return null;

      const missingLabels = missing.map((d) => DOCUMENT_TYPES.find((t) => t.key === d.document_type)?.label || d.document_type);
      return {
        student,
        enrollment,
        batch: enrollment.batch,
        center: enrollment.batch ? enrollment.batch.trainingCenter : null,
        missingLabels,
        submittedCount,
        totalCount: DOCUMENT_TYPE_KEYS.length,
      };
    })
    .filter(Boolean);
}

async function loadMissingEnrollments(query) {
  const batchWhere = {};
  if (query.center_id) batchWhere.training_center_id = query.center_id;

  const batchInclude = {
    model: Batch,
    as: 'batch',
    where: Object.keys(batchWhere).length ? batchWhere : undefined,
    required: !!Object.keys(batchWhere).length,
    include: [
      {
        model: TrainingCenter,
        as: 'trainingCenter',
        where: query.scheme_phase_id ? { scheme_phase_id: query.scheme_phase_id } : undefined,
        required: !!query.scheme_phase_id,
      },
    ],
  };
  if (query.batch_id) {
    batchInclude.where = { ...(batchInclude.where || {}), id: query.batch_id };
    batchInclude.required = true;
  }

  return Enrollment.findAll({
    where: { status: 'active' },
    include: [
      { model: Student, as: 'student', include: [{ model: StudentDocument, as: 'documents' }] },
      batchInclude,
    ],
    order: [['enrollment_date', 'ASC']],
  });
}

async function missingReport(req, res) {
  const enrollments = await loadMissingEnrollments(req.query);
  const rows = buildMissingRows(enrollments);
  const options = await loadReportFilterOptions();

  res.render('studentDocuments/missingReport', {
    title: 'Missing Documents Report',
    rows,
    ...options,
    filters: {
      center_id: req.query.center_id || '',
      scheme_phase_id: req.query.scheme_phase_id || '',
      batch_id: req.query.batch_id || '',
    },
  });
}

async function missingReportExport(req, res) {
  const enrollments = await loadMissingEnrollments(req.query);
  const rows = buildMissingRows(enrollments);
  const buffer = buildMissingDocumentsWorkbook(rows);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Missing-Documents-Report.xlsx"');
  res.send(buffer);
}

// Operator monitoring: for every document row that's ever been checked,
// bucket by who checked it. Caveat (same as the finance dashboard's
// director-wise totals): a student's batch here is whatever their most
// recent active enrollment is, which can differ from the batch they were
// in at the moment a given document was actually checked if they were
// later transferred.
async function monitorReport(req, res) {
  const where = { verified_by: { [Op.ne]: null } };
  if (req.query.from || req.query.to) {
    where.verified_at = {};
    if (req.query.from) where.verified_at[Op.gte] = new Date(req.query.from);
    if (req.query.to) where.verified_at[Op.lte] = new Date(`${req.query.to}T23:59:59`);
  }

  const docs = await StudentDocument.findAll({
    where,
    include: [
      { model: User, as: 'verifier', attributes: ['id', 'name'] },
      {
        model: Student,
        as: 'student',
        attributes: ['id', 'name', 'full_name'],
        include: [
          {
            model: Enrollment,
            as: 'enrollments',
            where: { status: 'active' },
            required: false,
            separate: true,
            limit: 1,
            order: [['id', 'DESC']],
            include: [{ model: Batch, as: 'batch', attributes: ['id', 'batch_code'] }],
          },
        ],
      },
    ],
    order: [['verified_at', 'DESC']],
  });

  const operators = new Map();
  docs.forEach((doc) => {
    if (!doc.verifier) return;
    const key = doc.verifier.id;
    if (!operators.has(key)) {
      operators.set(key, {
        operator: doc.verifier,
        studentIds: new Set(),
        submittedCount: 0,
        notSubmittedCount: 0,
        lastActivityAt: null,
        batches: new Map(),
      });
    }
    const stat = operators.get(key);
    stat.studentIds.add(doc.student.id);
    if (doc.status === 'submitted') stat.submittedCount += 1;
    else stat.notSubmittedCount += 1;
    if (!stat.lastActivityAt || new Date(doc.verified_at) > new Date(stat.lastActivityAt)) {
      stat.lastActivityAt = doc.verified_at;
    }
    const enrollment = doc.student.enrollments && doc.student.enrollments[0];
    const batchLabel = enrollment && enrollment.batch ? enrollment.batch.batch_code : 'Unassigned';
    stat.batches.set(batchLabel, (stat.batches.get(batchLabel) || 0) + 1);
  });

  const operatorRows = Array.from(operators.values())
    .map((s) => ({
      operator: s.operator,
      studentsTouched: s.studentIds.size,
      submittedCount: s.submittedCount,
      notSubmittedCount: s.notSubmittedCount,
      totalChecked: s.submittedCount + s.notSubmittedCount,
      lastActivityAt: s.lastActivityAt,
      batches: Array.from(s.batches.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
    }))
    .sort((a, b) => b.totalChecked - a.totalChecked);

  res.render('studentDocuments/monitorReport', {
    title: 'Document Verification — Operator Monitoring',
    operatorRows,
    filters: { from: req.query.from || '', to: req.query.to || '' },
  });
}

module.exports = { batchList, showBatch, updateBatch, missingReport, missingReportExport, monitorReport };
