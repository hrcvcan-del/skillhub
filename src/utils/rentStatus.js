async function syncRentStatus(rent) {
  if (rent.status === 'paid') return rent;

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = today > rent.due_date && Number(rent.amount_paid) < Number(rent.amount_due);
  const computed = isOverdue ? 'overdue' : 'pending';

  if (computed !== rent.status) {
    rent.status = computed;
    await rent.save();
  }
  return rent;
}

module.exports = { syncRentStatus };
