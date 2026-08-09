const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ALL_ROLES, ADMIN_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

router.use(requireAuth, requireRole(...ADMIN_ROLES));

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

router.get('/', userController.index);
router.get('/new', userController.newForm);
router.post(
  '/',
  identityDocsUpload,
  [...userValidators, body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  userController.create
);
router.get('/:id/edit', userController.editForm);
router.put('/:id', identityDocsUpload, userValidators, userController.update);
router.delete('/:id', userController.destroy);

module.exports = router;
