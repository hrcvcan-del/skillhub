const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const expenseController = require('../controllers/expenseController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

router.use(requireAuth, requireRole(...FINANCE_ROLES));

const validators = [
  body('category').isIn(expenseController.CATEGORIES).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('expense_date').isISO8601().withMessage('Expense date is required'),
];

router.get('/', expenseController.index);
router.get('/export.csv', expenseController.exportCsv);
router.get('/new', expenseController.newForm);
router.post('/', upload.single('receipt'), validators, expenseController.create);
router.get('/:id/edit', expenseController.editForm);
router.put('/:id', upload.single('receipt'), validators, expenseController.update);
router.delete('/:id', expenseController.destroy);

module.exports = router;
