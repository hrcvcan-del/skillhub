// Converts a staff member's fixed monthly salary into an hourly rate and
// computes what they've earned from actual clock in/out times: monthly
// salary -> per-day rate (salary / days in month) -> per-hour rate
// (per-day rate / 8) -> hours_worked * per-hour rate, summed over the
// month. A day with no attendance row, or one missing either time, earns
// 0 — nothing is assumed worked by default.
const { Op } = require('sequelize');
const { StaffAttendance } = require('../models');

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// in/out are "HH:MM" or "HH:MM:SS" strings (what a <input type="time">
// posts, and what Sequelize TIME columns read back as). Returns decimal
// hours, floored at 0 — an out-time at or before in-time (bad data, or a
// shift that crosses midnight, which this module doesn't attempt to
// support) earns nothing rather than a negative or huge number.
function computeHours(inTime, outTime) {
  if (!inTime || !outTime) return 0;
  const toMinutes = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const diffMinutes = toMinutes(outTime) - toMinutes(inTime);
  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) return 0;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

function perHourAmount(user, totalDays) {
  const monthlySalary = Number(user.salary_amount || 0);
  const perDayAmount = totalDays > 0 ? monthlySalary / totalDays : 0;
  return perDayAmount / 8;
}

async function getMonthAttendance(userId, month, year) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(month, year)).padStart(2, '0')}`;
  return StaffAttendance.findAll({ where: { user_id: userId, date: { [Op.between]: [start, end] } } });
}

async function getTotalHours(userId, month, year) {
  const rows = await getMonthAttendance(userId, month, year);
  return rows.reduce((sum, r) => sum + Number(r.hours_worked || 0), 0);
}

function computeSalary(user, totalHours, totalDays) {
  const hourlyRate = perHourAmount(user, totalDays);
  const computedAmount = Math.round(hourlyRate * totalHours * 100) / 100;
  return { hourlyRate, computedAmount };
}

module.exports = { daysInMonth, computeHours, perHourAmount, getMonthAttendance, getTotalHours, computeSalary };
