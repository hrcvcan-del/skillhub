const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { FINANCE_ROLES } = require('../utils/roles');

router.get('/', requireAuth, dashboardController.index);
router.get('/export.csv', requireAuth, requireRole(...FINANCE_ROLES), dashboardController.exportCsv);

module.exports = router;
