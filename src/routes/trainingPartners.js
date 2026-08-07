const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const trainingPartnerController = require('../controllers/trainingPartnerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { TRAINING_PARTNER_MANAGE_ROLES } = require('../utils/roles');

router.use(requireAuth);

const validators = [body('name').trim().notEmpty().withMessage('Name is required')];

router.get('/', requireRole(...TRAINING_PARTNER_MANAGE_ROLES), trainingPartnerController.index);
router.get('/new', requireRole(...TRAINING_PARTNER_MANAGE_ROLES), trainingPartnerController.newForm);
router.post('/', requireRole(...TRAINING_PARTNER_MANAGE_ROLES), validators, trainingPartnerController.create);

// A training_partner login editing their own profile — editForm/update
// force the id to req.currentUser.training_partner_id regardless of what's
// requested, so this is safe to open to the role.
router.get('/profile', requireRole('training_partner'), trainingPartnerController.editForm);
router.put('/profile', requireRole('training_partner'), validators, trainingPartnerController.update);

router.get('/:id/edit', requireRole(...TRAINING_PARTNER_MANAGE_ROLES), trainingPartnerController.editForm);
router.put('/:id', requireRole(...TRAINING_PARTNER_MANAGE_ROLES), validators, trainingPartnerController.update);

module.exports = router;
