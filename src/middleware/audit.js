const { AuditLog } = require('../models');

async function logAction(req, { action, entityType, entityId, oldValue = null, newValue = null }) {
  try {
    await AuditLog.create({
      user_id: req.currentUser ? req.currentUser.id : null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}

module.exports = { logAction };
