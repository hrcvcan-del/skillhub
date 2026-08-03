const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const centerController = require('../controllers/centerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('monthly_rent_amount').isFloat({ min: 0 }).withMessage('Monthly rent must be a positive number'),
  body('capacity').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Capacity must be a positive integer'),
];

router.get('/', centerController.index);
router.get('/new', requireRole('admin', 'manager'), centerController.newForm);
router.post('/', requireRole('admin', 'manager'), validators, centerController.create);
router.get('/:id', centerController.show);
router.get('/:id/edit', requireRole('admin', 'manager'), centerController.editForm);
router.put('/:id', requireRole('admin', 'manager'), validators, centerController.update);
router.delete('/:id', requireRole('admin'), centerController.destroy);

module.exports = router;
