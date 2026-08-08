// Converts a trainer's fixed monthly salary into a per-day rate and, from
// the days HR actually marked, computes what that trainer is owed for the
// month. A day with no attendance row at all counts as 0 — nothing is
// assumed present by default, so an unmarked day simply isn't paid for
// (forces HR to mark daily, per the institute's workflow).
const { Op } = require('sequelize');
const { TrainerAttendance } = require('../models');

const STATUS_WEIGHT = { present: 1, half_day: 0.5, absent: 0 };

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

async function getPresentDays(trainerId, month, year) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(month, year)).padStart(2, '0')}`;

  const rows = await TrainerAttendance.findAll({
    where: { trainer_id: trainerId, date: { [Op.between]: [start, end] } },
  });

  return rows.reduce((sum, r) => sum + (STATUS_WEIGHT[r.status] || 0), 0);
}

// totalDays: the divisor used to convert monthly salary -> per-day rate.
// Defaults to the real number of calendar days in that month, but is
// deliberately an explicit parameter (not hardcoded) so HR can override it
// on the generate-salary screen — e.g. an institute that only pays for
// weekdays would pass a smaller number.
function computeSalary(trainer, presentDays, totalDays) {
  const monthlySalary = Number(trainer.salary_amount || 0);
  const perDayAmount = totalDays > 0 ? monthlySalary / totalDays : 0;
  const computedAmount = Math.round(perDayAmount * presentDays * 100) / 100;
  return { perDayAmount, computedAmount };
}

module.exports = { daysInMonth, getPresentDays, computeSalary, STATUS_WEIGHT };
