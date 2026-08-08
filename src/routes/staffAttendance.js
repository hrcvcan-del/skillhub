const express = require('express');
const router = express.Router();

const staffAttendanceController = require('../controllers/staffAttendanceController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { STAFF_ATTENDANCE_ROLES, STAFF_PAYROLL_GENERATE_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

router.use(requireAuth);

// Self-service clock in/out — any authenticated user (a data_entry_operator
// or center_coordinator marking their own day); the page itself explains
// if their account isn't set up with a salary yet.
router.get('/me', staffAttendanceController.myAttendance);
router.post('/me/clock-in', staffAttendanceController.clockIn);
router.post('/me/clock-out', staffAttendanceController.clockOut);

router.get('/upload', requireRole(...STAFF_ATTENDANCE_ROLES), staffAttendanceController.uploadForm);
router.get('/upload/template', requireRole(...STAFF_ATTENDANCE_ROLES), staffAttendanceController.downloadTemplate);
router.post('/upload', requireRole(...STAFF_ATTENDANCE_ROLES), upload.statementUpload.single('file'), staffAttendanceController.upload);

router.get('/generate-salary', requireRole(...STAFF_PAYROLL_GENERATE_ROLES), staffAttendanceController.generateSalaryForm);
router.post('/generate-salary', requireRole(...STAFF_PAYROLL_GENERATE_ROLES), staffAttendanceController.generateSalary);

router.get('/summary', requireRole(...STAFF_ATTENDANCE_ROLES), staffAttendanceController.summary);
router.get('/', requireRole(...STAFF_ATTENDANCE_ROLES), staffAttendanceController.markForm);
router.post('/', requireRole(...STAFF_ATTENDANCE_ROLES), staffAttendanceController.mark);

module.exports = router;
