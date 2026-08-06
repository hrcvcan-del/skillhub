const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const bankAccountController = require('../controllers/bankAccountController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');

const roles = [...ADMIN_ROLES, 'accountant'];

router.use(requireAuth, requireRole(...roles));

const validators = [
  body('bank_name').trim().notEmpty().withMessage('Bank name is required'),
  body('account_name').trim().notEmpty().withMessage('Account name is required'),
  body('account_number').trim().notEmpty().withMessage('Account number is required'),
];

router.get('/', bankAccountController.index);
router.get('/new', bankAccountController.newForm);
router.post('/', validators, bankAccountController.create);
router.get('/:id/edit', bankAccountController.editForm);
router.put('/:id', validators, bankAccountController.update);

module.exports = router;
