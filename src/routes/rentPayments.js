const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const rentPaymentController = require('../controllers/rentPaymentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES, RENT_VIEW_ROLES } = require('../utils/roles');

// Any authenticated route here requires at least view access; individual
// write routes below tighten further to FINANCE_ROLES only — 'accountant'
// (part of RENT_VIEW_ROLES but not FINANCE_ROLES) can see rent status but
// not record/generate payments.
router.use(requireAuth, requireRole(...RENT_VIEW_ROLES));

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

// Placed before "/:id"-shaped routes so "generate-batch" isn't swallowed
// by a param route — there isn't one on this router today, but keeping
// the convention consistent with the other modules.
router.get('/generate-batch', requireRole(...FINANCE_ROLES), rentPaymentController.generateBatchForm);
router.post('/generate-batch', requireRole(...FINANCE_ROLES), rentPaymentController.generateBatch);

router.get('/', rentPaymentController.index);
router.post('/generate', requireRole(...FINANCE_ROLES), generateValidators, rentPaymentController.generateForMonth);
router.get('/new', requireRole(...FINANCE_ROLES), rentPaymentController.newForm);
router.post('/', requireRole(...FINANCE_ROLES), createValidators, rentPaymentController.create);
router.get('/:id/pay', requireRole(...FINANCE_ROLES), rentPaymentController.payForm);
router.post('/:id/pay', requireRole(...FINANCE_ROLES), payValidators, rentPaymentController.pay);

module.exports = router;
