const express = require('express');
const router = express.Router();

const assignmentReportController = require('../controllers/assignmentReportController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ASSIGNMENT_REPORT_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...ASSIGNMENT_REPORT_ROLES));

router.get('/', assignmentReportController.index);
router.get('/export.xlsx', assignmentReportController.exportExcel);

module.exports = router;
