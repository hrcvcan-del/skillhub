const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const trainerController = require('../controllers/trainerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../config/upload');

router.use(requireAuth);

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('salary_type').isIn(['monthly', 'per_batch', 'hourly']).withMessage('Invalid salary type'),
  body('salary_amount').isFloat({ min: 0 }).withMessage('Salary amount must be a positive number'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
];

// Aadhar card + education certificate are optional identity documents,
// same JPEG/PNG/WEBP/PDF upload config as expense receipts.
const identityDocsUpload = upload.fields([
  { name: 'aadhar_card', maxCount: 1 },
  { name: 'education_certificate', maxCount: 1 },
]);

router.get('/', trainerController.index);
router.get('/new', requireRole('admin', 'manager'), trainerController.newForm);
router.post('/', requireRole('admin', 'manager'), identityDocsUpload, validators, trainerController.create);
router.get('/:id', trainerController.show);
router.get('/:id/edit', requireRole('admin', 'manager'), trainerController.editForm);
router.put('/:id', requireRole('admin', 'manager'), identityDocsUpload, validators, trainerController.update);
router.delete('/:id', requireRole('admin'), trainerController.destroy);

module.exports = router;
