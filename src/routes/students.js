const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const studentController = require('../controllers/studentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole, blockRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');

const editRoles = [...ADMIN_ROLES, 'manager', 'staff', 'center_coordinator', 'mobilizer', 'data_entry_operator', 'training_center'];

router.use(requireAuth);
// center_manager is add-only (Centers/Users/Trainers) and never touches
// Students at all — see src/utils/roles.js.
router.use(blockRole('center_manager'));

const baseValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  // Free text (not a fixed list) — categories vary by scheme/state
  // (e.g. NT-B, NT-C, VJ, SBC), see src/models/student.js.
  body('caste_category').optional({ checkFalsy: true }).trim(),
  body('aadhaar_number')
    .optional({ checkFalsy: true })
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Aadhaar number must be exactly 12 digits'),
];

const createValidators = [
  ...baseValidators,
  body('center_id').isInt().withMessage('Center is required'),
  body('batch_id').isInt().withMessage('Batch is required'),
  body('total_fee').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Total fee must be a positive number'),
];

router.get('/', studentController.index);
// Placed before "/:id" so "centers" isn't swallowed by the id param route.
router.get('/centers', studentController.centersIndex);
router.get('/new', requireRole(...editRoles), studentController.newForm);
router.post('/', requireRole(...editRoles), createValidators, studentController.create);
router.get('/:id', studentController.show);
router.get('/:id/edit', requireRole(...editRoles), studentController.editForm);
router.put('/:id', requireRole(...editRoles), baseValidators, studentController.update);
router.delete('/:id', requireRole(...ADMIN_ROLES, 'manager'), studentController.destroy);

module.exports = router;
