const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const centerController = require('../controllers/centerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

const manageRoles = [...ADMIN_ROLES, 'manager', 'center_coordinator'];

router.use(requireAuth);

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('monthly_rent_amount').isFloat({ min: 0 }).withMessage('Monthly rent must be a positive number'),
  body('capacity').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Capacity must be a positive integer'),
];

// Placed before "/:id" so "bulk-upload" isn't swallowed by the id param route.
router.get('/bulk-upload', requireRole(...manageRoles), centerController.bulkUploadForm);
router.get('/bulk-upload/template', requireRole(...manageRoles), centerController.downloadTemplate);
router.post('/bulk-upload', requireRole(...manageRoles), upload.statementUpload.single('file'), centerController.bulkUpload);

router.get('/', centerController.index);
router.get('/new', requireRole(...manageRoles), centerController.newForm);
router.post('/', requireRole(...manageRoles), validators, centerController.create);
router.get('/:id', centerController.show);
router.get('/:id/edit', requireRole(...manageRoles), centerController.editForm);
router.put('/:id', requireRole(...manageRoles), validators, centerController.update);
router.delete('/:id', requireRole(...ADMIN_ROLES), centerController.destroy);

module.exports = router;
