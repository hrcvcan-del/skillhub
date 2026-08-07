// Sequelize DATEONLY fields come back as plain 'YYYY-MM-DD' strings, not JS
// Date objects, so this just re-slices the string — no timezone conversion,
// avoiding the off-by-one-day shift that Date-based formatting is prone to.
function toDDMMYYYY(isoDateStr) {
  if (!isoDateStr) return '';
  const [y, m, d] = String(isoDateStr).split('-');
  if (!y || !m || !d) return String(isoDateStr);
  return `${d}-${m}-${y}`;
}

module.exports = { toDDMMYYYY };
