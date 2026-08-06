const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const transferController = require('../controllers/transferController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');

const roles = [...ADMIN_ROLES, 'manager', 'center_coordinator', 'staff'];

router.use(requireAuth, requireRole(...roles));

router.get('/', transferController.wizard);
router.post(
  '/',
  [
    body('enrollment_id').isInt().withMessage('Select a student to transfer'),
    body('to_batch_id').isInt().withMessage('Select a destination batch'),
  ],
  transferController.transfer
);

module.exports = router;
