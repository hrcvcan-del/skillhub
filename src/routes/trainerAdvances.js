const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const trainerAdvanceController = require('../controllers/trainerAdvanceController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { TRAINER_ADVANCE_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...TRAINER_ADVANCE_ROLES));

const validators = [
  body('trainer_id').isInt().withMessage('Trainer is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('advance_date').isISO8601().withMessage('Date is required'),
];

router.get('/', trainerAdvanceController.index);
router.get('/new', trainerAdvanceController.newForm);
router.post('/', validators, trainerAdvanceController.create);

module.exports = router;
