// The production container runs in UTC, but every SkillHub center is in
// India — a plain `new Date()` local-time read would tag a late-evening
// IST moment with yesterday's UTC date (UTC has no DST, so the +5:30
// offset is constant; this stays correct regardless of what timezone the
// host OS is actually set to). Shared by anything that needs "today" in
// IST as a fallback default — see src/utils/staffAttendanceCalc.js for
// the sibling "now" (HH:MM) version used by the staff clock in/out.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

// "YYYY-MM-DD" for today in IST.
function todayISOIST() {
  return istNow().toISOString().slice(0, 10);
}

module.exports = { istNow, todayISOIST };
