const express = require('express');
const router = express.Router();

const centerManagerController = require('../controllers/centerManagerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole('center_manager', ...ADMIN_ROLES));

router.get('/', centerManagerController.home);

module.exports = router;
