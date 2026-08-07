const express = require('express');
const router = express.Router();

const suspenseController = require('../controllers/suspenseController');
const transactionController = require('../controllers/bankTransactionController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...FINANCE_ROLES));

router.get('/', suspenseController.index);
router.post('/bulk-assign', transactionController.bulkAssign);
router.post('/bulk-delete', transactionController.bulkDestroy);
router.get('/:id', transactionController.show);
router.get('/:id/assign', transactionController.assignForm);
router.post('/:id/assign', transactionController.assign);
router.post('/:id/ignore', transactionController.ignore);
router.post('/:id/verify', transactionController.verify);
router.delete('/:id', transactionController.destroy);

module.exports = router;
