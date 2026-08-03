const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const batchController = require('../controllers/batchController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const validators = [
  body('course_id').isInt().withMessage('Course is required'),
  body('training_center_id').isInt().withMessage('Training center is required'),
  body('start_date').isISO8601().withMessage('Start date is required'),
  body('end_date').isISO8601().withMessage('End date is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
];

router.get('/', batchController.index);
router.get('/new', requireRole('admin', 'manager', 'staff'), batchController.newForm);
router.post('/', requireRole('admin', 'manager', 'staff'), validators, batchController.create);
router.get('/:id', batchController.show);
router.get('/:id/edit', requireRole('admin', 'manager', 'staff'), batchController.editForm);
router.put('/:id', requireRole('admin', 'manager', 'staff'), validators, batchController.update);
router.delete('/:id', requireRole('admin', 'manager'), batchController.destroy);

module.exports = router;
