const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('../controllers/trainingPartnerCandidateController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth, requireRole('training_partner'));

const validators = [
  body('candidate_name').trim().notEmpty().withMessage('Candidate name is required'),
  body('training_cost').isFloat({ min: 0.01 }).withMessage('Training cost must be greater than 0'),
  body('trained_date').isISO8601().withMessage('Trained date is required'),
];

router.get('/', controller.index);
router.get('/new', controller.newForm);
router.post('/', validators, controller.create);

module.exports = router;
