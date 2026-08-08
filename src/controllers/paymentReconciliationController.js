// Bulk payment-confirmation upload: instead of manually opening each
// bank transaction in Suspense and assigning it, this matches a row
// (account number + amount) straight to the pending Trainer Salary /
// Rent record it's paying off and applies the SAME assign-then-verify
// sequence the manual flow uses (via applyAssignment/recomputeStatus,
// exported from bankTransactionController.js) — so everything still
// flows through the one reconciliation ledger (Assignment Report,
// category totals, audit log) rather than a separate ad-hoc "mark paid".
const { Op } = require('sequelize');
const { BankAccount, BankTransaction, BankTransactionAssignment, Trainer, TrainerSalaryPayment, TrainingCenter, RentPayment } = require('../models');
const { applyAssignment, recomputeStatus } = require('./bankTransactionController');
const { logAction } = require('../middleware/audit');
const { parsePaymentConfirmationFile } = require('../utils/paymentConfirmationParser');

const AMOUNT_TOLERANCE = 1; // paise/rupee rounding slack when comparing amounts

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function uploadForm(req, res) {
  const bankAccounts = await BankAccount.findAll({ where: { is_active: true }, order: [['bank_name', 'ASC']] });
  res.render('paymentReconciliation/upload', {
    title: 'Upload Payment Confirmation',
    bankAccounts,
    results: null,
    errors: null,
    paymentDate: todayISO(),
  });
}

// Finds the pending due (trainer salary or rent) matching an account
// number + amount, plus a reason string when nothing matched — used to
// give a specific, actionable message per row rather than a bare "no
// match".
async function findMatch(accountNumber, amount) {
  const trainer = await Trainer.findOne({ where: { bank_account_number: accountNumber } });
  if (trainer) {
    const pending = await TrainerSalaryPayment.findAll({
      where: { trainer_id: trainer.id, status: 'pending' },
      order: [['for_year', 'ASC'], ['for_month', 'ASC']],
    });
    const match = pending.find((p) => Math.abs(Number(p.amount) + Number(p.bonus_amount) - Number(p.deduction_amount) - amount) <= AMOUNT_TOLERANCE);
    if (match) return { type: 'trainer_salary', record: match, name: trainer.name };
    if (pending.length === 0) return { type: null, reason: `"${trainer.name}" (trainer) has no pending salary due — may already be paid` };
    return { type: null, reason: `"${trainer.name}" (trainer) has pending salary due(s) but none matched ₹${amount.toLocaleString('en-IN')}` };
  }

  const center = await TrainingCenter.findOne({ where: { owner_bank_account_number: accountNumber } });
  if (center) {
    const pending = await RentPayment.findAll({
      where: { training_center_id: center.id, status: { [Op.in]: ['pending', 'overdue'] } },
      order: [['for_year', 'ASC'], ['for_month', 'ASC']],
    });
    const match = pending.find((p) => Math.abs(Number(p.amount_due) - Number(p.amount_paid) - amount) <= AMOUNT_TOLERANCE);
    if (match) return { type: 'rent', record: match, name: center.name };
    if (pending.length === 0) return { type: null, reason: `"${center.name}" (center) has no pending rent due — may already be paid` };
    return { type: null, reason: `"${center.name}" (center) has pending rent due(s) but none matched ₹${amount.toLocaleString('en-IN')}` };
  }

  return { type: null, reason: 'No trainer or center found with this account number' };
}

async function upload(req, res) {
  const bankAccounts = await BankAccount.findAll({ where: { is_active: true }, order: [['bank_name', 'ASC']] });
  const rerender = (formErrors) =>
    res.status(422).render('paymentReconciliation/upload', {
      title: 'Upload Payment Confirmation',
      bankAccounts,
      results: null,
      errors: formErrors,
      paymentDate: req.body.payment_date || todayISO(),
    });

  if (!req.body.bank_account_id) {
    return rerender([{ field: 'bank_account_id', message: 'Select which bank account this batch of payments went out from' }]);
  }
  if (!req.file) {
    return rerender([{ field: 'file', message: 'Please choose a CSV, XLS, or XLSX file to upload' }]);
  }

  let parsed;
  try {
    parsed = parsePaymentConfirmationFile(req.file.path);
  } catch (err) {
    return rerender([{ field: 'file', message: err.message }]);
  }
  if (parsed.warning) return rerender([{ field: 'file', message: parsed.warning }]);
  if (parsed.rows.length === 0) {
    return rerender([{ field: 'file', message: 'No payment rows were found in this file.' }]);
  }

  const paymentDate = req.body.payment_date || todayISO();
  const marked = [];
  const failed = [];
  const unmatched = [];

  for (const row of parsed.rows) {
    if (row.status === 'failed') {
      failed.push({ rowNumber: row.rowNumber, accountNumber: row.accountNumber, amount: row.amount });
      continue; // eslint-disable-line no-continue -- bank reported this one didn't go through; leave the due untouched
    }

    // eslint-disable-next-line no-await-in-loop
    const match = await findMatch(row.accountNumber, row.amount);
    if (!match.type) {
      unmatched.push({ rowNumber: row.rowNumber, accountNumber: row.accountNumber, amount: row.amount, reason: match.reason });
      continue; // eslint-disable-line no-continue
    }

    // eslint-disable-next-line no-await-in-loop
    const transaction = await BankTransaction.create({
      bank_account_id: req.body.bank_account_id,
      transaction_date: paymentDate,
      debit_amount: row.amount,
      narration: `Bulk payment confirmation — ${match.name}`,
      payment_mode: 'neft',
      status: 'unassigned',
    });

    const body = match.type === 'trainer_salary' ? { trainer_salary_payment_id: match.record.id } : { rent_payment_id: match.record.id };
    // eslint-disable-next-line no-await-in-loop
    const result = await applyAssignment(transaction, row.amount, match.type, body, req.currentUser);
    if (!result.ok) {
      // eslint-disable-next-line no-await-in-loop
      await transaction.destroy();
      unmatched.push({ rowNumber: row.rowNumber, accountNumber: row.accountNumber, amount: row.amount, reason: result.message });
      continue; // eslint-disable-line no-continue
    }

    // eslint-disable-next-line no-await-in-loop
    await recomputeStatus(transaction);
    // A direct account+amount match from a confirmed payment file needs no
    // human review — verify it immediately, same fields the manual
    // "Verify" button sets.
    // eslint-disable-next-line no-await-in-loop
    const assignment = await BankTransactionAssignment.findOne({ where: { bank_transaction_id: transaction.id } });
    // eslint-disable-next-line no-await-in-loop
    await assignment.update({ verified_by: req.currentUser.id, verified_at: new Date() });
    // eslint-disable-next-line no-await-in-loop
    await transaction.update({ status: 'verified' });

    // eslint-disable-next-line no-await-in-loop
    await logAction(req, {
      action: 'reconcile',
      entityType: 'BankTransaction',
      entityId: transaction.id,
      newValue: { matchedType: match.type, matchedId: match.record.id, amount: row.amount },
    });

    marked.push({ rowNumber: row.rowNumber, name: match.name, type: match.type === 'trainer_salary' ? 'Trainer Salary' : 'Rent', amount: row.amount });
  }

  res.render('paymentReconciliation/upload', {
    title: 'Upload Payment Confirmation',
    bankAccounts,
    results: { marked, failed, unmatched, totalRows: parsed.rows.length },
    errors: null,
    paymentDate,
  });
}

module.exports = { uploadForm, upload };
