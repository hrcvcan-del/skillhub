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

// Sequelize turns `{ field: [1,2,3] }` into `IN (1,2,3)`, but `{ field: [] }`
// produces `IN ()`, which some drivers/dialects reject. Use this whenever a
// scoped-but-empty id list needs to go in a `where` clause so it reliably
// matches nothing instead of erroring.
const NO_MATCH_ID = -1;

function centerIdsWhereValue(centerIds) {
  return centerIds.length === 0 ? NO_MATCH_ID : centerIds;
}

module.exports = { getScopedCenterIds, getStudentIdsAtCenters, centerIdsWhereValue, NO_MATCH_ID };
