const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('../controllers/trainingPartnerBillController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');

// Both the training_partner role (their own bills) and Finance Director
// (every partner's bills) land here — controllers scope by
// req.currentUser internally.
router.use(requireAuth, requireRole('training_partner', ...FINANCE_ROLES));

const generateValidators = [
  body('period_from').isISO8601().withMessage('Period start date is required'),
  body('period_to').isISO8601().withMessage('Period end date is required'),
];

router.get('/', controller.index);
router.get('/new', requireRole('training_partner'), controller.newForm);
router.post('/', requireRole('training_partner'), generateValidators, controller.create);
router.get('/:id', controller.show);
router.post('/:id/approve', requireRole(...FINANCE_ROLES), controller.approve);
router.post('/:id/reject', requireRole(...FINANCE_ROLES), controller.reject);

module.exports = router;
