const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const rentPaymentController = require('../controllers/rentPaymentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...FINANCE_ROLES));

const createValidators = [
  body('training_center_id').isInt().withMessage('Center is required'),
  body('for_month').isInt({ min: 1, max: 12 }).withMessage('Month is required'),
  body('for_year').isInt({ min: 2000 }).withMessage('Year is required'),
  body('amount_due').isFloat({ min: 0 }).withMessage('Amount due must be a positive number'),
  body('due_date').isISO8601().withMessage('Due date is required'),
];

const payValidators = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
  body('payment_mode').isIn(['cash', 'upi', 'card', 'bank_transfer']).withMessage('Invalid payment mode'),
  body('paid_date').isISO8601().withMessage('Paid date is required'),
];

const generateValidators = [
  body('for_month').isInt({ min: 1, max: 12 }).withMessage('Month is required'),
  body('for_year').isInt({ min: 2000, max: 2100 }).withMessage('Year is required'),
];

router.get('/', rentPaymentController.index);
router.post('/generate', generateValidators, rentPaymentController.generateForMonth);
router.get('/new', rentPaymentController.newForm);
router.post('/', createValidators, rentPaymentController.create);
router.get('/:id/pay', rentPaymentController.payForm);
router.post('/:id/pay', payValidators, rentPaymentController.pay);

module.exports = router;
