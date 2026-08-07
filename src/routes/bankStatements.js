const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const bankStatementController = require('../controllers/bankStatementController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

router.use(requireAuth, requireRole(...FINANCE_ROLES));

const validators = [body('bank_account_id').isInt().withMessage('Bank account is required')];

router.get('/', bankStatementController.index);
router.get('/upload', bankStatementController.uploadForm);
router.post('/upload', upload.statementUpload.single('file'), validators, bankStatementController.upload);

module.exports = router;
