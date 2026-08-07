const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const salaryPaymentController = require('../controllers/salaryPaymentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...FINANCE_ROLES));

const payValidators = [
  body('bonus_amount').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Bonus must be a positive number'),
  body('deduction_amount').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Deduction must be a positive number'),
  body('payment_date').isISO8601().withMessage('Payment date is required'),
  body('payment_mode').isIn(['cash', 'upi', 'card', 'bank_transfer']).withMessage('Invalid payment mode'),
  body('status').isIn(['pending', 'paid', 'partially_paid']).withMessage('Invalid status'),
];

const generateValidators = [
  body('for_month').isInt({ min: 1, max: 12 }).withMessage('Month is required'),
  body('for_year').isInt({ min: 2000, max: 2100 }).withMessage('Year is required'),
];

router.get('/', salaryPaymentController.index);
router.post('/generate', generateValidators, salaryPaymentController.generateForMonth);
router.get('/trainer/:trainerId', salaryPaymentController.trainerHistory);
router.get('/:id/pay', salaryPaymentController.payForm);
router.post('/:id/pay', payValidators, salaryPaymentController.pay);

module.exports = router;
