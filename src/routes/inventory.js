const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const inventoryController = require('../controllers/inventoryController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../config/upload');

router.use(requireAuth);

const validators = [
  body('training_center_id').isInt().withMessage('Center is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unit_purchase_cost').isFloat({ min: 0 }).withMessage('Unit cost must be a positive number'),
  body('condition').isIn(inventoryController.CONDITIONS).withMessage('Invalid condition'),
];

router.get('/', inventoryController.index);
router.get('/valuation', requireRole('admin', 'manager'), inventoryController.valuationReport);
router.get('/upload', requireRole('admin', 'manager', 'staff'), inventoryController.uploadForm);
router.get('/upload/template', requireRole('admin', 'manager', 'staff'), inventoryController.downloadTemplate);
router.post('/upload', requireRole('admin', 'manager', 'staff'), upload.statementUpload.single('file'), inventoryController.upload);
router.get('/new', requireRole('admin', 'manager', 'staff'), inventoryController.newForm);
router.post('/', requireRole('admin', 'manager', 'staff'), validators, inventoryController.create);
router.get('/:id/edit', requireRole('admin', 'manager', 'staff'), inventoryController.editForm);
router.put('/:id', requireRole('admin', 'manager', 'staff'), validators, inventoryController.update);
router.delete('/:id', requireRole('admin', 'manager'), inventoryController.destroy);

module.exports = router;
