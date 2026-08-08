const { Op } = require('sequelize');
const { Trainer, TrainerAttendance, User, TrainerSalaryPayment, TrainerAdvance } = require('../models');
const { logAction } = require('../middleware/audit');
const { daysInMonth, getPresentDays, computeSalary } = require('../utils/attendanceCalc');
const { buildNeftWorkbook } = require('../utils/neftExport');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// GET /attendance — mark today's (or any chosen date's) attendance for
// every active trainer in one page.
async function markForm(req, res) {
  const date = req.query.date || todayISO();
  const trainers = await Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  const attendances = await TrainerAttendance.findAll({
    where: { date, trainer_id: trainers.map((t) => t.id) },
    include: [{ model: User, as: 'markedByUser', attributes: ['id', 'name'] }],
  });
  const byTrainerId = new Map(attendances.map((a) => [a.trainer_id, a]));

  res.render('attendance/mark', {
    title: 'Mark Trainer Attendance',
    date,
    trainers,
    byTrainerId,
  });
}

// POST /attendance — one radio-group per trainer; a trainer with no
// selection is left untouched (not silently marked absent) so HR can mark
// a subset of trainers on a given day without affecting the rest.
async function mark(req, res) {
  const date = req.body.date || todayISO();
  const statuses = req.body.status || {};

  let count = 0;
  for (const [trainerIdKey, status] of Object.entries(statuses)) {
    if (!['present', 'absent', 'half_day'].includes(status)) continue; // eslint-disable-line no-continue
    const trainerId = trainerIdKey.replace(/^t/, '');

    // eslint-disable-next-line no-await-in-loop
    const [attendance] = await TrainerAttendance.findOrCreate({
      where: { trainer_id: trainerId, date },
      defaults: { trainer_id: trainerId, date, status, marked_by: req.currentUser.id },
    });
    const oldValue = attendance.toJSON();
    // eslint-disable-next-line no-await-in-loop
    await attendance.update({ status, marked_by: req.currentUser.id });
    if (oldValue.status !== status) {
      // eslint-disable-next-line no-await-in-loop
      await logAction(req, {
        action: 'update',
        entityType: 'TrainerAttendance',
        entityId: attendance.id,
        oldValue,
        newValue: attendance.toJSON(),
      });
    }
    count += 1;
  }

  req.setFlash('success', `Attendance saved for ${count} trainer(s) on ${date}.`);
  res.redirect(`/attendance?date=${date}`);
}

// GET /attendance/summary — a read-only day-by-day grid for the month, so
// HR/admin can visually spot-check before running payroll.
async function summary(req, res) {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const totalDays = daysInMonth(month, year);

  const trainers = await Trainer.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
  const attendances = await TrainerAttendance.findAll({
    where: { trainer_id: trainers.map((t) => t.id), date: { [Op.between]: [start, end] } },
  });

  const grid = new Map(); // trainerId -> { day -> status }
  trainers.forEach((t) => grid.set(t.id, {}));
  attendances.forEach((a) => {
    const day = parseInt(String(a.date).split('-')[2], 10);
    grid.get(a.trainer_id)[day] = a.status;
  });

  res.render('attendance/summary', {
    title: 'Monthly Attendance Summary',
    trainers,
    grid,
    month,
    year,
    totalDays,
    days: Array.from({ length: totalDays }, (_, i) => i + 1),
  });
}

// GET /attendance/generate-salary — preview: every active, monthly-salaried
// trainer with their live-computed present days / per-day rate / amount for
// the chosen month, so HR can pick which ones to finalize and export.
async function generateSalaryForm(req, res) {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const totalDays = parseInt(req.query.total_days, 10) || daysInMonth(month, year);

  // Attendance-based conversion only makes sense for trainers paid a fixed
  // monthly amount — 'per_batch'/'hourly' trainers aren't touched by this
  // screen at all (they stay on the regular Generate-for-month flow).
  const trainers = await Trainer.findAll({
    where: { is_active: true, salary_type: 'monthly' },
    order: [['name', 'ASC']],
  });

  const rows = await Promise.all(
    trainers.map(async (trainer) => {
      const presentDays = await getPresentDays(trainer.id, month, year);
      const { perDayAmount, computedAmount } = computeSalary(trainer, presentDays, totalDays);
      const missingBankDetails = !trainer.bank_account_number || !trainer.ifsc_code;
      return { trainer, presentDays, perDayAmount, computedAmount, missingBankDetails };
    })
  );

  res.render('attendance/generateSalary', {
    title: 'Generate Salary from Attendance',
    rows,
    month,
    year,
    totalDays,
  });
}

// POST /attendance/generate-salary — for each selected trainer: upsert
// their TrainerSalaryPayment.amount for the month (only touches rows still
// 'pending' — never overwrites something already paid/partially paid),
// auto-deducting pending advances the same way the regular monthly
// generator does, then streams the NEFT/RTGS Excel for exactly the
// trainers that had usable bank details.
async function generateSalary(req, res) {
  const month = parseInt(req.body.month, 10);
  const year = parseInt(req.body.year, 10);
  const totalDays = parseInt(req.body.total_days, 10) || daysInMonth(month, year);
  const trainerIds = [].concat(req.body.trainer_ids || []);

  if (trainerIds.length === 0) {
    req.setFlash('error', 'Select at least one trainer to generate salary for.');
    return res.redirect(`/attendance/generate-salary?month=${month}&year=${year}`);
  }

  const trainers = await Trainer.findAll({ where: { id: trainerIds, is_active: true, salary_type: 'monthly' } });

  const included = [];
  const skippedNoBankDetails = [];
  const skippedAlreadyPaid = [];

  for (const trainer of trainers) {
    const presentDays = await getPresentDays(trainer.id, month, year); // eslint-disable-line no-await-in-loop
    const { computedAmount } = computeSalary(trainer, presentDays, totalDays);

    const pendingAdvances = await TrainerAdvance.findAll({ where: { trainer_id: trainer.id, status: 'pending' } }); // eslint-disable-line no-await-in-loop
    const advanceTotal = pendingAdvances.reduce((sum, a) => sum + Number(a.amount), 0);

    let salaryPayment = await TrainerSalaryPayment.findOne({ where: { trainer_id: trainer.id, for_month: month, for_year: year } }); // eslint-disable-line no-await-in-loop

    if (salaryPayment && salaryPayment.status !== 'pending') {
      // Already paid/partially paid — never touch the DB row and never
      // include it in the bank file again (re-exporting it would risk a
      // double payment via bank transfer).
      skippedAlreadyPaid.push(trainer.name);
      continue; // eslint-disable-line no-continue
    } else if (salaryPayment) {
      // eslint-disable-next-line no-await-in-loop
      await salaryPayment.update({ amount: computedAmount, deduction_amount: advanceTotal });
    } else {
      // eslint-disable-next-line no-await-in-loop
      salaryPayment = await TrainerSalaryPayment.create({
        trainer_id: trainer.id,
        for_month: month,
        for_year: year,
        amount: computedAmount,
        deduction_amount: advanceTotal,
        status: 'pending',
      });
    }

    if (pendingAdvances.length > 0 && salaryPayment.status === 'pending') {
      // eslint-disable-next-line no-await-in-loop
      await TrainerAdvance.update(
        { status: 'deducted', deducted_in_salary_payment_id: salaryPayment.id },
        { where: { id: pendingAdvances.map((a) => a.id) } }
      );
    }

    if (!trainer.bank_account_number || !trainer.ifsc_code) {
      skippedNoBankDetails.push(trainer.name);
      continue; // eslint-disable-line no-continue -- salary due was still recorded above, just not in the bank file
    }

    // The bank transfer is the NET payable — gross attendance-based salary
    // minus any pending advance being deducted this month (bonus, if any,
    // is added later by hand when the payment is actually recorded on
    // /salary-payments, so it isn't part of this generated figure).
    const netAmount = Math.max(computedAmount - advanceTotal, 0);

    included.push({
      accountNumber: trainer.bank_account_number,
      name: trainer.name,
      amount: netAmount,
      ifscCode: trainer.ifsc_code,
      email: trainer.email,
      bankName: trainer.bank_name,
    });
  }

  await logAction(req, {
    action: 'generate',
    entityType: 'TrainerSalaryPayment',
    entityId: null,
    newValue: { month, year, totalDays, trainerCount: trainers.length, exportedCount: included.length },
  });

  const skipParts = [];
  if (skippedNoBankDetails.length > 0) skipParts.push(`missing bank details: ${skippedNoBankDetails.join(', ')}`);
  if (skippedAlreadyPaid.length > 0) skipParts.push(`already paid/partially paid this month, left untouched: ${skippedAlreadyPaid.join(', ')}`);

  if (included.length === 0) {
    req.setFlash('error', `No trainers were exported — ${skipParts.length > 0 ? skipParts.join('; ') : 'nothing to export.'}`);
    return res.redirect(`/attendance/generate-salary?month=${month}&year=${year}`);
  }

  if (skipParts.length > 0) {
    req.setFlash('error', `Some trainers were skipped from the Excel — ${skipParts.join('; ')}.`);
  }

  const buffer = buildNeftWorkbook(included);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const filename = `Salary-NEFT-${monthNames[month - 1]}-${year}.xls`;

  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { markForm, mark, summary, generateSalaryForm, generateSalary };
