const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const mobilizationController = require('../controllers/mobilizationController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const {
  MOBILIZATION_ENTRY_ROLES,
  MOBILIZATION_REVIEW_ROLES,
  MOBILIZATION_DAILY_ROLES,
  MOBILIZATION_VIEW_ROLES,
} = require('../utils/roles');

router.use(requireAuth, requireRole(...MOBILIZATION_VIEW_ROLES));

const createValidators = [
  body('training_center_id').isInt().withMessage('Training center is required'),
  body('trainer_id').isInt().withMessage('Trainer is required'),
  body('center_coordinator_id').isInt().withMessage('Center coordinator is required'),
  body('form_date').isISO8601().withMessage('Date is required'),
  body('forms_submitted_count').isInt({ min: 0 }).withMessage('Form count must be a positive number'),
];

const dailyValidators = [
  body('training_center_id').isInt().withMessage('Training center is required'),
  body('trainer_id').isInt().withMessage('Trainer is required'),
  body('count_date').isISO8601().withMessage('Date is required'),
  body('admissions_count').isInt({ min: 0 }).withMessage('Admission count must be a positive number'),
];

// Placed before "/:id"-shaped routes so "daily"/"summary" aren't
// swallowed by the id param route.
router.get('/summary', mobilizationController.summary);
router.get('/daily', requireRole(...MOBILIZATION_DAILY_ROLES), mobilizationController.dailyIndex);
router.get('/daily/new', requireRole(...MOBILIZATION_DAILY_ROLES), mobilizationController.dailyForm);
router.post('/daily', requireRole(...MOBILIZATION_DAILY_ROLES), dailyValidators, mobilizationController.dailySave);

router.get('/', mobilizationController.index);
router.get('/new', requireRole(...MOBILIZATION_ENTRY_ROLES), mobilizationController.newForm);
router.post('/', requireRole(...MOBILIZATION_ENTRY_ROLES), createValidators, mobilizationController.create);
router.get('/:id/review', requireRole(...MOBILIZATION_REVIEW_ROLES), mobilizationController.reviewForm);
router.post('/:id/review', requireRole(...MOBILIZATION_REVIEW_ROLES), mobilizationController.review);

module.exports = router;
