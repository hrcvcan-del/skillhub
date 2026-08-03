function computeStatus(batch) {
  if (batch.status === 'cancelled') return 'cancelled';

  const today = new Date().toISOString().slice(0, 10);
  if (today < batch.start_date) return 'upcoming';
  if (today > batch.end_date) return 'completed';
  return 'ongoing';
}

async function syncBatchStatus(batch) {
  const computed = computeStatus(batch);
  if (computed !== batch.status && batch.status !== 'cancelled') {
    batch.status = computed;
    await batch.save();
  }
  return batch;
}

module.exports = { computeStatus, syncBatchStatus };
