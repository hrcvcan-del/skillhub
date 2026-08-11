// Converts a staff member's fixed monthly salary into an hourly rate and
// computes what they've earned from actual clock in/out times: monthly
// salary -> per-day rate (salary / days in month) -> per-hour rate
// (per-day rate / 8) -> hours_worked * per-hour rate, summed over the
// month. A day with no attendance row, or one missing either time, earns
// 0 — nothing is assumed worked by default.
const { Op } = require('sequelize');
const { StaffAttendance } = require('../models');
const { istNow, todayISOIST } = require('./istDate');

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// "HH:MM" (24h) for right now in IST — the raw value stored in the DB;
// formatTime12h() below converts it for display.
function nowTimeIST() {
  const d = istNow();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
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

// "HH:MM" or "HH:MM:SS" (24h, what the DB/inputs use) -> "h:MM AM/PM" for
// display to staff, since the self-service clock in/out is meant to read
// like a punch clock, not a 24h system timestamp.
function formatTime12h(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
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

module.exports = {
  daysInMonth,
  computeHours,
  formatTime12h,
  todayISOIST,
  nowTimeIST,
  perHourAmount,
  getMonthAttendance,
  getTotalHours,
  computeSalary,
};
