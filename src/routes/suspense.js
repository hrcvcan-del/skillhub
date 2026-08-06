const express = require('express');
const router = express.Router();

const suspenseController = require('../controllers/suspenseController');
const transactionController = require('../controllers/bankTransactionController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');

const roles = [...ADMIN_ROLES, 'accountant'];

router.use(requireAuth, requireRole(...roles));

router.get('/', suspenseController.index);
router.get('/:id', transactionController.show);
router.get('/:id/assign', transactionController.assignForm);
router.post('/:id/assign', transactionController.assign);
router.post('/:id/ignore', transactionController.ignore);
router.post('/:id/verify', transactionController.verify);

module.exports = router;
