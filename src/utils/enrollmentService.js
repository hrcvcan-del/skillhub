const { Op } = require('sequelize');
const { Enrollment, Batch, FeePayment } = require('../models');
const { ensureStudentDocuments } = require('./studentDocumentService');
const { todayISOIST } = require('./istDate');

function computeFeeDue(totalFee, discount, feePaid) {
  const due = Number(totalFee || 0) - Number(discount || 0) - Number(feePaid || 0);
  return due > 0 ? due : 0;
}

async function checkBatchCapacity(batchId, { excludeEnrollmentId = null } = {}) {
  const batch = await Batch.findByPk(batchId);
  if (!batch) return { ok: false, message: 'Invalid batch' };

  const where = { batch_id: batchId, status: 'active' };
  if (excludeEnrollmentId) where.id = { [Op.ne]: excludeEnrollmentId };
  const activeCount = await Enrollment.count({ where });

  if (activeCount >= batch.capacity) {
    return { ok: false, message: 'This batch is already at full capacity', batch };
  }
  return { ok: true, batch };
}

async function checkDuplicateEnrollment(studentId, batchId, { excludeEnrollmentId = null } = {}) {
  const where = { batch_id: batchId, student_id: studentId, status: 'active' };
  if (excludeEnrollmentId) where.id = { [Op.ne]: excludeEnrollmentId };
  const duplicate = await Enrollment.findOne({ where });
  return !!duplicate;
}

async function createEnrollment({
  studentId,
  batchId,
  enrollmentDate,
  totalFee,
  discount,
  feePaid,
  paymentMode,
  recordedByUserId,
  transaction,
}) {
  // With Enrollment Date removed from the Add Student form, this fallback
  // now runs on every single admission — must be IST, not the container's
  // UTC clock, or a same-day IST admission near midnight could get dated
  // "yesterday". See src/utils/istDate.js.
  const today = todayISOIST();
  const feeDue = computeFeeDue(totalFee, discount, feePaid);

  const enrollment = await Enrollment.create(
    {
      student_id: studentId,
      batch_id: batchId,
      enrollment_date: enrollmentDate || today,
      total_fee: totalFee || 0,
      discount_amount: discount || 0,
      fee_paid: feePaid || 0,
      fee_due: feeDue,
      status: 'active',
    },
    { transaction }
  );

  if (Number(feePaid) > 0) {
    await FeePayment.create(
      {
        enrollment_id: enrollment.id,
        amount: feePaid,
        payment_date: enrollmentDate || today,
        payment_mode: paymentMode || 'cash',
        recorded_by: recordedByUserId,
      },
      { transaction }
    );
  }

  // Guarantees the 5-document checklist exists for this student. Safe to
  // call on every enrollment (transfers included) — findOrCreate is a
  // no-op once the rows already exist.
  await ensureStudentDocuments(studentId, { transaction });

  return enrollment;
}

module.exports = { computeFeeDue, checkBatchCapacity, checkDuplicateEnrollment, createEnrollment };
