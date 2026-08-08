const express = require('express');
const router = express.Router();

const paymentReconciliationController = require('../controllers/paymentReconciliationController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

router.use(requireAuth, requireRole(...FINANCE_ROLES));

router.get('/', paymentReconciliationController.uploadForm);
router.post('/', upload.statementUpload.single('file'), paymentReconciliationController.upload);

module.exports = router;
