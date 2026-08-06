const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const schemeController = require('../controllers/schemeController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');

const manageRoles = [...ADMIN_ROLES, 'scheme_manager'];

router.use(requireAuth);

const schemeValidators = [body('name').trim().notEmpty().withMessage('Name is required')];

const phaseValidators = [
  body('name').trim().notEmpty().withMessage('Phase name is required'),
  body('target_candidates').isInt({ min: 0 }).withMessage('Target must be a positive number'),
  body('status').isIn(['planning', 'active', 'completed', 'cancelled']).withMessage('Invalid status'),
];

router.get('/', schemeController.index);
router.get('/new', requireRole(...manageRoles), schemeController.newForm);
router.post('/', requireRole(...manageRoles), schemeValidators, schemeController.create);
router.get('/:id', schemeController.show);
router.get('/:id/edit', requireRole(...manageRoles), schemeController.editForm);
router.put('/:id', requireRole(...manageRoles), schemeValidators, schemeController.update);
router.delete('/:id', requireRole(...ADMIN_ROLES), schemeController.destroy);

router.post('/:schemeId/phases', requireRole(...manageRoles), phaseValidators, schemeController.createPhase);
router.get('/:schemeId/phases/:id/edit', requireRole(...manageRoles), schemeController.editPhaseForm);
router.put('/:schemeId/phases/:id', requireRole(...manageRoles), phaseValidators, schemeController.updatePhase);
router.delete('/:schemeId/phases/:id', requireRole(...ADMIN_ROLES), schemeController.destroyPhase);

module.exports = router;
