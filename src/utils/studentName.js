// Full Name is no longer typed in on Add Student (removed in favor of
// separate First/Middle/Surname fields) — this combines those three parts
// into one display string for anywhere that still wants "the whole name"
// as a single value, e.g. the Joining Data report's Full Name column.
// Falls back to an explicitly-set `full_name` first, if a record has one
// from before the split (or from a manual Edit), so older data isn't
// silently overridden by the computed version.
function combineFullName(student) {
  if (student.full_name) return student.full_name;
  return [student.name, student.middle_name, student.last_name].filter(Boolean).join(' ').trim();
}

module.exports = { combineFullName };
