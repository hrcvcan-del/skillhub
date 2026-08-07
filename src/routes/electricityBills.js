const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const electricityBillController = require('../controllers/electricityBillController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ELECTRICITY_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...ELECTRICITY_ROLES));

const validators = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('expense_date').isISO8601().withMessage('Bill date is required'),
];

router.get('/', electricityBillController.index);
router.get('/new', electricityBillController.newForm);
router.post('/', validators, electricityBillController.create);

module.exports = router;
