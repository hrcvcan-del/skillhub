// A 'training_partner' login only ever sees/edits its own TrainingPartner
// record (and its own candidates/bills) via
// User.training_partner_id — the same pattern as center_coordinator's
// TrainingCenter.coordinator_id scoping in centerScope.js.
function getOwnTrainingPartnerId(user) {
  if (!user || user.role !== 'training_partner') return null;
  return user.training_partner_id || null;
}

module.exports = { getOwnTrainingPartnerId };
