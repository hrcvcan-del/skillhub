const { Op } = require('sequelize');
const { User, StaffAttendance } = require('../models');
const { logAction } = require('../middleware/audit');
const {
  daysInMonth,
  computeHours,
  formatTime12h,
  todayISOIST,
  nowTimeIST,
  getTotalHours,
  computeSalary,
} = require('../utils/staffAttendanceCalc');
const { buildStaffAttendanceTemplateWorkbook, parseStaffAttendanceBulkFile } = require('../utils/staffAttendanceBulkUpload');
const { buildNeftWorkbook } = require('../utils/neftExport');
const { STAFF_TRACKED_ROLES } = require('../utils/roles');

// Every SkillHub center is in India — attendance dates/times always use
// IST regardless of what timezone the app server itself happens to run
// in (the production container runs in UTC).
const todayISO = todayISOIST;

async function trackedStaff() {
  return User.findAll({ where: { role: STAFF_TRACKED_ROLES, is_active: true }, order: [['name', 'ASC']] });
}

// GET /staff-attendance — HR/admin mark today's (or any date's) in/out
// time for every tracked staff member in one page.
async function markForm(req, res) {
  const date = req.query.date || todayISO();
  const staff = await trackedStaff();
  const attendances = await StaffAttendance.findAll({ where: { date, user_id: staff.map((s) => s.id) } });
  const byUserId = new Map(attendances.map((a) => [a.user_id, a]));

  res.render('staffAttendance/mark', { title: 'Mark Staff Attendance', date, staff, byUserId });
}

// Shared by the manual-mark form and the self-service clock in/out — sets
// in/out times for one (user, date), recomputes hours_worked, and only
// audit-logs when something actually changed.
async function upsertAttendance({ userId, date, inTime, outTime, source, markedBy, req }) {
  const [attendance] = await StaffAttendance.findOrCreate({
    where: { user_id: userId, date },
    defaults: { user_id: userId, date, source, marked_by: markedBy },
  });
  const oldValue = attendance.toJSON();

  const nextIn = inTime !== undefined ? inTime : attendance.in_time;
  const nextOut = outTime !== undefined ? outTime : attendance.out_time;
  const hours = computeHours(nextIn, nextOut);

  await attendance.update({ in_time: nextIn, out_time: nextOut, hours_worked: hours, source, marked_by: markedBy });

  if (oldValue.in_time !== attendance.in_time || oldValue.out_time !== attendance.out_time) {
    await logAction(req, {
      action: 'update',
      entityType: 'StaffAttendance',
      entityId: attendance.id,
      oldValue,
      newValue: attendance.toJSON(),
    });
  }
  return attendance;
}

// POST /staff-attendance — a trainer with no time entered for either
// field is left untouched, same "mark a subset, leave the rest" behavior
// as the trainer attendance form.
async function mark(req, res) {
  const date = req.body.date || todayISO();
  const inTimes = req.body.in_time || {};
  const outTimes = req.body.out_time || {};
  const touchedIds = new Set([...Object.keys(inTimes), ...Object.keys(outTimes)]);

  let count = 0;
  for (const key of touchedIds) {
    const userId = key.replace(/^u/, '');
    const inTime = inTimes[key] || null;
    const outTime = outTimes[key] || null;
    if (!inTime && !outTime) continue; // eslint-disable-line no-continue

    // eslint-disable-next-line no-await-in-loop
    await upsertAttendance({ userId, date, inTime, outTime, source: 'manual', markedBy: req.currentUser.id, req });
    count += 1;
  }

  req.setFlash('success', `Attendance saved for ${count} staff member(s) on ${date}.`);
  res.redirect(`/staff-attendance?date=${date}`);
}

// GET /staff-attendance/me — self-service: today's status + a quick
// clock-in/clock-out, plus this month's running total.
async function myAttendance(req, res) {
  const date = todayISO();
  const today = await StaffAttendance.findOne({ where: { user_id: req.currentUser.id, date } });

  // Derived from the already-IST `date` string rather than a fresh
  // `new Date()` (which would read the container's UTC clock).
  const monthStart = `${date.slice(0, 7)}-01`;
  const monthRows = await StaffAttendance.findAll({
    where: { user_id: req.currentUser.id, date: { [Op.between]: [monthStart, date] } },
    order: [['date', 'ASC']],
  });

  res.render('staffAttendance/myAttendance', {
    title: 'My Attendance',
    date,
    today,
    monthRows,
    hasSalarySetUp: !!req.currentUser.salary_amount,
    formatTime12h,
  });
}

async function clockIn(req, res) {
  const time = nowTimeIST();
  await upsertAttendance({
    userId: req.currentUser.id,
    date: todayISO(),
    inTime: time,
    source: 'self',
    markedBy: req.currentUser.id,
    req,
  });
  req.setFlash('success', `In Time marked at ${formatTime12h(time)}.`);
  res.redirect('/staff-attendance/me');
}

async function clockOut(req, res) {
  const time = nowTimeIST();
  await upsertAttendance({
    userId: req.currentUser.id,
    date: todayISO(),
    outTime: time,
    source: 'self',
    markedBy: req.currentUser.id,
    req,
  });
  req.setFlash('success', `Out Time marked at ${formatTime12h(time)}.`);
  res.redirect('/staff-attendance/me');
}

// GET /staff-attendance/summary — read-only monthly grid of total hours
// per staff member per day, to spot-check before payroll.
async function summary(req, res) {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const totalDays = daysInMonth(month, year);

  const staff = await trackedStaff();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
  const attendances = await StaffAttendance.findAll({
    where: { user_id: staff.map((s) => s.id), date: { [Op.between]: [start, end] } },
  });

  const grid = new Map();
  staff.forEach((s) => grid.set(s.id, {}));
  attendances.forEach((a) => {
    const day = parseInt(String(a.date).split('-')[2], 10);
    grid.get(a.user_id)[day] = Number(a.hours_worked);
  });

  res.render('staffAttendance/summary', {
    title: 'Monthly Staff Attendance Summary',
    staff,
    grid,
    month,
    year,
    totalDays,
    days: Array.from({ length: totalDays }, (_, i) => i + 1),
  });
}

// GET /staff-attendance/upload — the bulk Excel upload form + template.
function uploadForm(req, res) {
  res.render('staffAttendance/upload', { title: 'Bulk Upload Staff Attendance', results: null, errors: null });
}

function downloadTemplate(req, res) {
  const buffer = buildStaffAttendanceTemplateWorkbook();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="staff-attendance-template.xlsx"');
  res.send(buffer);
}

async function upload(req, res) {
  const rerender = (formErrors) =>
    res.status(422).render('staffAttendance/upload', { title: 'Bulk Upload Staff Attendance', results: null, errors: formErrors });

  if (!req.file) {
    return rerender([{ field: 'file', message: 'Please choose a CSV, XLS, or XLSX file to upload' }]);
  }

  let parsed;
  try {
    parsed = parseStaffAttendanceBulkFile(req.file.path);
  } catch (err) {
    return rerender([{ field: 'file', message: err.message }]);
  }
  if (parsed.warning) return rerender([{ field: 'file', message: parsed.warning }]);
  if (parsed.rows.length === 0) {
    return rerender([{ field: 'file', message: 'No attendance rows were found in this file. Rows need at least Staff Email and Date.' }]);
  }

  const staff = await User.findAll({ where: { role: STAFF_TRACKED_ROLES } });
  const staffByEmail = new Map(staff.map((s) => [(s.email || '').toLowerCase(), s]));

  const applied = [];
  const skipped = [];

  for (const row of parsed.rows) {
    if (row.error) {
      skipped.push({ rowNumber: row.rowNumber, email: row.email || '', errors: [row.error] });
      continue; // eslint-disable-line no-continue
    }
    const user = staffByEmail.get(row.email);
    if (!user) {
      skipped.push({ rowNumber: row.rowNumber, email: row.email, errors: ['No matching data_entry_operator/center_coordinator account with this email'] });
      continue; // eslint-disable-line no-continue
    }
    if (!row.inTime && !row.outTime) {
      skipped.push({ rowNumber: row.rowNumber, email: row.email, errors: ['Neither In Time nor Out Time could be read'] });
      continue; // eslint-disable-line no-continue
    }

    // eslint-disable-next-line no-await-in-loop
    await upsertAttendance({
      userId: user.id,
      date: row.date,
      inTime: row.inTime,
      outTime: row.outTime,
      source: 'excel_upload',
      markedBy: req.currentUser.id,
      req,
    });
    applied.push({ rowNumber: row.rowNumber, name: user.name, date: row.date });
  }

  res.render('staffAttendance/upload', {
    title: 'Bulk Upload Staff Attendance',
    results: { applied, skipped, totalRows: parsed.rows.length },
    errors: null,
  });
}

// GET /staff-attendance/generate-salary — preview every tracked, active
// staff member with their live-computed hours / hourly rate / amount.
async function generateSalaryForm(req, res) {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const totalDays = parseInt(req.query.total_days, 10) || daysInMonth(month, year);

  const staff = await trackedStaff();
  const rows = await Promise.all(
    staff.map(async (user) => {
      const totalHours = await getTotalHours(user.id, month, year);
      const { hourlyRate, computedAmount } = computeSalary(user, totalHours, totalDays);
      const missingSalarySetup = !user.salary_amount;
      const missingBankDetails = !user.bank_account_number || !user.ifsc_code;
      return { user, totalHours, hourlyRate, computedAmount, missingSalarySetup, missingBankDetails };
    })
  );

  res.render('staffAttendance/generateSalary', {
    title: 'Generate Staff Salary from Attendance',
    rows,
    month,
    year,
    totalDays,
  });
}

// POST /staff-attendance/generate-salary — unlike trainer payroll, there's
// no persistent "due/paid" ledger for staff (no StaffSalaryPayment table)
// since none existed before this module — the audit log records that a
// generation happened (who, when, for how many staff) and the downloaded
// Excel is the record of what was actually sent to the bank. Streams the
// NEFT/RTGS file for staff with usable bank details.
async function generateSalary(req, res) {
  const month = parseInt(req.body.month, 10);
  const year = parseInt(req.body.year, 10);
  const totalDays = parseInt(req.body.total_days, 10) || daysInMonth(month, year);
  const userIds = [].concat(req.body.user_ids || []);

  if (userIds.length === 0) {
    req.setFlash('error', 'Select at least one staff member to generate salary for.');
    return res.redirect(`/staff-attendance/generate-salary?month=${month}&year=${year}`);
  }

  const staff = await User.findAll({ where: { id: userIds, role: STAFF_TRACKED_ROLES, is_active: true } });

  const included = [];
  const skippedNoSalarySetup = [];
  const skippedNoBankDetails = [];

  for (const user of staff) {
    if (!user.salary_amount) {
      skippedNoSalarySetup.push(user.name);
      continue; // eslint-disable-line no-continue
    }
    // eslint-disable-next-line no-await-in-loop
    const totalHours = await getTotalHours(user.id, month, year);
    const { computedAmount } = computeSalary(user, totalHours, totalDays);

    if (!user.bank_account_number || !user.ifsc_code) {
      skippedNoBankDetails.push(user.name);
      continue; // eslint-disable-line no-continue
    }

    included.push({
      accountNumber: user.bank_account_number,
      name: user.name,
      amount: computedAmount,
      ifscCode: user.ifsc_code,
      email: user.email,
      bankName: user.bank_name,
    });
  }

  await logAction(req, {
    action: 'generate',
    entityType: 'StaffAttendance',
    entityId: null,
    newValue: { month, year, totalDays, staffCount: staff.length, exportedCount: included.length },
  });

  const skipParts = [];
  if (skippedNoSalarySetup.length > 0) skipParts.push(`no monthly salary set: ${skippedNoSalarySetup.join(', ')}`);
  if (skippedNoBankDetails.length > 0) skipParts.push(`missing bank details: ${skippedNoBankDetails.join(', ')}`);

  if (included.length === 0) {
    req.setFlash('error', `No staff were exported — ${skipParts.length > 0 ? skipParts.join('; ') : 'nothing to export.'}`);
    return res.redirect(`/staff-attendance/generate-salary?month=${month}&year=${year}`);
  }
  if (skipParts.length > 0) {
    req.setFlash('error', `Some staff were skipped from the Excel — ${skipParts.join('; ')}.`);
  }

  const buffer = buildNeftWorkbook(included);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const filename = `Staff-Salary-NEFT-${monthNames[month - 1]}-${year}.xls`;

  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = {
  markForm,
  mark,
  myAttendance,
  clockIn,
  clockOut,
  summary,
  uploadForm,
  downloadTemplate,
  upload,
  generateSalaryForm,
  generateSalary,
};
