// Center Coordinators (and 'training_center' logins — the center/institute
// itself, added later, granted a narrower slice of what a coordinator can
// do but scoped the exact same way) only manage the center(s) they're
// assigned to via TrainingCenter.coordinator_id (a center "belongs to" one
// coordinator user, but a user could coordinate more than one center).
// Every other role sees institute-wide data, so callers get `null` back to
// mean "unrestricted" rather than having to special-case every role
// themselves.
const { TrainingCenter, Enrollment, Batch } = require('../models');

const SCOPED_ROLES = ['center_coordinator', 'training_center'];

async function getScopedCenterIds(user) {
  if (!user || !SCOPED_ROLES.includes(user.role)) return null;
  const centers = await TrainingCenter.findAll({
    where: { coordinator_id: user.id },
    attributes: ['id'],
  });
  return centers.map((c) => c.id);
}

// A Data Entry Operator can only add students to batches a Center
// Coordinator (or admin/director/manager/master_admin) has explicitly
// assigned them to via Batch.student_entry_operator_id — mirrors the
// document_verifier_id assignment/scoping pattern, but for admissions
// data entry rather than document checking, and as a SEPARATE
// assignment (a center may want different people doing each job).
// Returns null (unrestricted) for every other role, same convention as
// getScopedCenterIds.
async function getScopedBatchIdsForDeo(user) {
  if (!user || user.role !== 'data_entry_operator') return null;
  const batches = await Batch.findAll({ where: { student_entry_operator_id: user.id }, attributes: ['id'] });
  return batches.map((b) => b.id);
}

// Students don't carry a training_center_id themselves — center membership
// only exists via their enrollments' batches. Returns the distinct ids of
// students enrolled at any of the given centers.
async function getStudentIdsAtCenters(centerIds) {
  if (centerIds.length === 0) return [];
  const enrollments = await Enrollment.findAll({
    attributes: ['student_id'],
    include: [{ model: Batch, as: 'batch', attributes: [], required: true, where: { training_center_id: centerIds } }],
    group: ['student_id'],
  });
  return enrollments.map((e) => e.student_id);
}

// Same idea as getStudentIdsAtCenters, but for a Data Entry Operator's
// batch-level scope (Batch.student_entry_operator_id) rather than a
// center-level one — the distinct students enrolled in any of the given
// batches.
async function getStudentIdsAtBatches(batchIds) {
  if (batchIds.length === 0) return [];
  const enrollments = await Enrollment.findAll({
    attributes: ['student_id'],
    where: { batch_id: batchIds },
    group: ['student_id'],
  });
  return enrollments.map((e) => e.student_id);
}

// A DEO's assigned batches can span more than one center (different
// coordinators assigning the same operator), so "which centers does this
// DEO work with" is derived from their assigned batches rather than
// TrainingCenter.coordinator_id (which only ever applies to
// center_coordinator/training_center). Used for the "pick a training
// center" step of both the Add Student flow and the Students tab's
// center -> batch -> students drill-down.
async function centersForDeoBatchIds(deoBatchIds) {
  if (deoBatchIds.length === 0) return [];
  const batches = await Batch.findAll({ where: { id: deoBatchIds }, attributes: ['training_center_id'], group: ['training_center_id'] });
  const centerIds = batches.map((b) => b.training_center_id);
  return TrainingCenter.findAll({ where: { id: centerIdsWhereValue(centerIds) }, order: [['name', 'ASC']] });
}

// Sequelize turns `{ field: [1,2,3] }` into `IN (1,2,3)`, but `{ field: [] }`
// produces `IN ()`, which some drivers/dialects reject. Use this whenever a
// scoped-but-empty id list needs to go in a `where` clause so it reliably
// matches nothing instead of erroring.
const NO_MATCH_ID = -1;

function centerIdsWhereValue(centerIds) {
  return centerIds.length === 0 ? NO_MATCH_ID : centerIds;
}

module.exports = {
  getScopedCenterIds,
  getScopedBatchIdsForDeo,
  getStudentIdsAtCenters,
  getStudentIdsAtBatches,
  centersForDeoBatchIds,
  centerIdsWhereValue,
  NO_MATCH_ID,
};
