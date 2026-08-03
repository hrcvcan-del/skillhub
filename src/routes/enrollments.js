const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const enrollmentController = require('../controllers/enrollmentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const createValidators = [
  body('student_id').isInt().withMessage('Student is required'),
  body('batch_id').isInt().withMessage('Batch is required'),
  body('total_fee').isFloat({ min: 0 }).withMessage('Total fee must be a positive number'),
];

const updateValidators = [
  body('total_fee').isFloat({ min: 0 }).withMessage('Total fee must be a positive number'),
  body('status').isIn(['active', 'completed', 'dropped']).withMessage('Invalid status'),
];

router.get('/new', requireRole('admin', 'manager', 'staff'), enrollmentController.newForm);
router.post('/', requireRole('admin', 'manager', 'staff'), createValidators, enrollmentController.create);
router.get('/:id', enrollmentController.show);
router.get('/:id/edit', requireRole('admin', 'manager', 'staff'), enrollmentController.editForm);
router.put('/:id', requireRole('admin', 'manager', 'staff'), updateValidators, enrollmentController.update);

module.exports = router;
