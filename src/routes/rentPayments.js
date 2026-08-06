const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const rentPaymentController = require('../controllers/rentPaymentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

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

const financeRoles = ['admin', 'manager', 'accountant'];

router.get('/', requireRole(...financeRoles), rentPaymentController.index);
router.post('/generate', requireRole(...financeRoles), generateValidators, rentPaymentController.generateForMonth);
router.get('/new', requireRole(...financeRoles), rentPaymentController.newForm);
router.post('/', requireRole(...financeRoles), createValidators, rentPaymentController.create);
router.get('/:id/pay', requireRole(...financeRoles), rentPaymentController.payForm);
router.post('/:id/pay', requireRole(...financeRoles), payValidators, rentPaymentController.pay);

module.exports = router;
