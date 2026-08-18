const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const trainerController = require('../controllers/trainerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole, blockRole } = require('../middleware/roles');
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

// index/show have no role restriction beyond auth for anyone else, but
// center_manager (add-only) must never reach a list/show page — see
// src/utils/roles.js.
router.get('/', blockRole('center_manager'), trainerController.index);
router.get('/upload', requireRole('admin', 'manager'), trainerController.uploadForm);
router.get('/upload/template', requireRole('admin', 'manager'), trainerController.downloadTemplate);
router.post('/upload', requireRole('admin', 'manager'), upload.statementUpload.single('file'), trainerController.upload);
router.get('/new', requireRole('admin', 'manager', 'center_manager'), trainerController.newForm);
router.post('/', requireRole('admin', 'manager', 'center_manager'), identityDocsUpload, validators, trainerController.create);
router.get('/:id', blockRole('center_manager'), trainerController.show);
// HR can edit a trainer's own details (name, bank details) and toggle
// Active/Inactive — that toggle is what actually removes them from the
// daily Mark Trainer Attendance list (see attendanceController.markForm's
// `where: { is_active: true }`), so HR needs this to keep that list
// current, not just view it.
router.get('/:id/edit', requireRole('admin', 'manager', 'hr'), trainerController.editForm);
router.put('/:id', requireRole('admin', 'manager', 'hr'), identityDocsUpload, validators, trainerController.update);
router.delete('/:id', requireRole('admin'), trainerController.destroy);

module.exports = router;
