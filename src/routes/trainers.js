const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const trainerController = require('../controllers/trainerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('salary_type').isIn(['monthly', 'per_batch', 'hourly']).withMessage('Invalid salary type'),
  body('salary_amount').isFloat({ min: 0 }).withMessage('Salary amount must be a positive number'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
];

router.get('/', trainerController.index);
router.get('/new', requireRole('admin', 'manager'), trainerController.newForm);
router.post('/', requireRole('admin', 'manager'), validators, trainerController.create);
router.get('/:id', trainerController.show);
router.get('/:id/edit', requireRole('admin', 'manager'), trainerController.editForm);
router.put('/:id', requireRole('admin', 'manager'), validators, trainerController.update);
router.delete('/:id', requireRole('admin'), trainerController.destroy);

module.exports = router;
