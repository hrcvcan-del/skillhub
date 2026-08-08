const express = require('express');
const router = express.Router();

const attendanceController = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ATTENDANCE_ROLES, PAYROLL_GENERATE_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...ATTENDANCE_ROLES));

// Payroll generation is a broader tier (also finance_director/accountant)
// than plain attendance marking, so it needs its own check — placed before
// "/summary" isn't necessary since it's a distinct literal path, but kept
// grouped here for readability.
router.get('/generate-salary', requireRole(...PAYROLL_GENERATE_ROLES), attendanceController.generateSalaryForm);
router.post('/generate-salary', requireRole(...PAYROLL_GENERATE_ROLES), attendanceController.generateSalary);

router.get('/summary', attendanceController.summary);
router.get('/', attendanceController.markForm);
router.post('/', attendanceController.mark);

module.exports = router;
