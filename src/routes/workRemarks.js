const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const workRemarkController = require('../controllers/workRemarkController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { WORK_REMARK_VIEW_ROLES } = require('../utils/roles');

router.use(requireAuth);

const createValidators = [
  body('remark_date').isISO8601().withMessage('Date is required'),
  body('work_type').trim().notEmpty().withMessage('Work type is required'),
  body('remark').optional({ checkFalsy: true }).trim(),
];

// Self-service — any authenticated user can log/see their own day, same
// as staff attendance clock-in/out. The nav link is what actually scopes
// this to center_coordinator/data_entry_operator in practice.
router.get('/me', workRemarkController.myIndex);
router.post('/me', createValidators, workRemarkController.create);
router.delete('/me/:id', workRemarkController.destroySelf);

router.get('/monitor', requireRole(...WORK_REMARK_VIEW_ROLES), workRemarkController.monitor);
router.get('/monitor/export', requireRole(...WORK_REMARK_VIEW_ROLES), workRemarkController.monitorExport);

module.exports = router;
