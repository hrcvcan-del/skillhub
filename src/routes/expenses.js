const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const expenseController = require('../controllers/expenseController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../config/upload');

router.use(requireAuth);

const validators = [
  body('category').isIn(expenseController.CATEGORIES).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('expense_date').isISO8601().withMessage('Expense date is required'),
];

router.get('/', expenseController.index);
router.get('/export.csv', requireRole('admin', 'manager'), expenseController.exportCsv);
router.get('/new', requireRole('admin', 'manager', 'staff'), expenseController.newForm);
router.post('/', requireRole('admin', 'manager', 'staff'), upload.single('receipt'), validators, expenseController.create);
router.get('/:id/edit', requireRole('admin', 'manager', 'staff'), expenseController.editForm);
router.put('/:id', requireRole('admin', 'manager', 'staff'), upload.single('receipt'), validators, expenseController.update);
router.delete('/:id', requireRole('admin', 'manager'), expenseController.destroy);

module.exports = router;
