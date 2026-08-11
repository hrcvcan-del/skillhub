const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ALL_ROLES, ADMIN_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

router.use(requireAuth);

// Full manage (list/edit/delete) — admin/director only. center_manager gets
// a narrower create-only slice below: it can reach GET /new and POST / to
// add a Center Coordinator/Data Entry Operator/Mobilizer account (further
// restricted to exactly those three roles server-side in
// userController.create — see CENTER_MANAGER_ASSIGNABLE_ROLES), but never
// the list, an existing user's edit page, or delete.
const manageRoles = ADMIN_ROLES;
const createRoles = [...ADMIN_ROLES, 'center_manager'];

const userValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(ALL_ROLES).withMessage('Invalid role'),
];

// Aadhar card + education certificate are optional identity documents,
// same JPEG/PNG/WEBP/PDF upload config as expense receipts.
const identityDocsUpload = upload.fields([
  { name: 'aadhar_card', maxCount: 1 },
  { name: 'education_certificate', maxCount: 1 },
]);

router.get('/', requireRole(...manageRoles), userController.index);
router.get('/new', requireRole(...createRoles), userController.newForm);
router.post(
  '/',
  requireRole(...createRoles),
  identityDocsUpload,
  [...userValidators, body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  userController.create
);
router.get('/:id/edit', requireRole(...manageRoles), userController.editForm);
router.put('/:id', requireRole(...manageRoles), identityDocsUpload, userValidators, userController.update);
router.delete('/:id', requireRole(...manageRoles), userController.destroy);

module.exports = router;
