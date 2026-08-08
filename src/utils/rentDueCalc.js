// Each center's rent is due on the same day-of-month every month, taken
// from when its lease actually started (lease_start_date) — not a single
// fixed calendar date shared by every center. e.g. a center whose lease
// started on the 15th is due on the 15th of every month going forward.

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// Falls back to day 1 if lease_start_date was never recorded, so the
// center still shows up somewhere rather than being silently excluded.
function rentDueDay(center) {
  if (!center.lease_start_date) return 1;
  const day = parseInt(String(center.lease_start_date).split('-')[2], 10);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
}

// Clamped to the actual last day of the target month — a center due on
// the 31st is due on the 28th/29th/30th in a shorter month, not rolled
// into the next month.
function dueDateForCenter(center, month, year) {
  const day = Math.min(rentDueDay(center), daysInMonth(month, year));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysUntil(dateStr, referenceDate = new Date()) {
  const target = new Date(`${dateStr}T00:00:00`);
  const ref = new Date(referenceDate.toISOString().slice(0, 10) + 'T00:00:00');
  return Math.round((target - ref) / (1000 * 60 * 60 * 24));
}

module.exports = { daysInMonth, rentDueDay, dueDateForCenter, daysUntil };
