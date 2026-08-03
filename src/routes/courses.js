const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const courseController = require('../controllers/courseController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('duration_weeks').isInt({ min: 1 }).withMessage('Duration must be at least 1 week'),
  body('fee_amount').isFloat({ min: 0 }).withMessage('Fee must be a positive number'),
];

router.get('/', courseController.index);
router.get('/new', requireRole('admin', 'manager'), courseController.newForm);
router.post('/', requireRole('admin', 'manager'), validators, courseController.create);
router.get('/:id/edit', requireRole('admin', 'manager'), courseController.editForm);
router.put('/:id', requireRole('admin', 'manager'), validators, courseController.update);
router.delete('/:id', requireRole('admin'), courseController.destroy);

module.exports = router;
