const {
  BankTransaction,
  BankAccount,
  BankTransactionAssignment,
  TrainerSalaryPayment,
  Trainer,
  RentPayment,
  TrainingCenter,
  Expense,
  Director,
  TrainingPartnerBill,
  TrainingPartner,
  User,
} = require('../models');
const { logAction } = require('../middleware/audit');
const { CATEGORIES: EXPENSE_CATEGORIES } = require('../controllers/expenseController');

function transactionAmount(t) {
  return Number(t.debit_amount) > 0 ? Number(t.debit_amount) : Number(t.credit_amount);
}

function assignedTotal(assignments) {
  return assignments.reduce((sum, a) => sum + Number(a.amount), 0);
}

async function recomputeStatus(bankTransaction) {
  const assignments = await BankTransactionAssignment.findAll({ where: { bank_transaction_id: bankTransaction.id } });
  const total = assignedTotal(assignments);
  const amount = transactionAmount(bankTransaction);

  let status;
  if (total <= 0) status = 'unassigned';
  else if (total < amount) status = 'partially_assigned';
  else status = 'assigned';

  if (bankTransaction.status !== 'verified' && bankTransaction.status !== status) {
    await bankTransaction.update({ status });
  }
  return status;
}

async function loadDetail(id) {
  return BankTransaction.findByPk(id, {
    include: [
      { model: BankAccount, as: 'bankAccount' },
      {
        model: BankTransactionAssignment,
        as: 'assignments',
        include: [
          { model: Expense, as: 'expense' },
          { model: TrainerSalaryPayment, as: 'trainerSalaryPayment', include: [{ model: Trainer, as: 'trainer' }] },
          { model: RentPayment, as: 'rentPayment', include: [{ model: TrainingCenter, as: 'trainingCenter' }] },
          { model: Director, as: 'director' },
          { model: TrainingPartnerBill, as: 'trainingPartnerBill', include: [{ model: TrainingPartner, as: 'trainingPartner' }] },
          { model: User, as: 'assignedByUser' },
          { model: User, as: 'verifiedByUser' },
        ],
      },
    ],
  });
}

async function loadAssignOptions() {
  const [pendingSalaries, pendingRents, centers, directors, unpaidBills] = await Promise.all([
    TrainerSalaryPayment.findAll({
      where: { status: ['pending', 'partially_paid'] },
      include: [{ model: Trainer, as: 'trainer' }],
      order: [['for_year', 'DESC'], ['for_month', 'DESC']],
    }),
    RentPayment.findAll({
      where: { status: ['pending', 'overdue'] },
      include: [{ model: TrainingCenter, as: 'trainingCenter' }],
      order: [['for_year', 'DESC'], ['for_month', 'DESC']],
    }),
    TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    Director.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
    TrainingPartnerBill.findAll({
      where: { status: ['approved'] },
      include: [{ model: TrainingPartner, as: 'trainingPartner' }],
      order: [['created_at', 'DESC']],
    }),
  ]);

  // Only bills that aren't fully paid off yet — status alone doesn't flip
  // to 'paid' until amount_paid reaches net_amount (see applyAssignment
  // below), so filter the rest here.
  const payableBills = unpaidBills.filter((b) => Number(b.amount_paid) < Number(b.net_amount));

  return { pendingSalaries, pendingRents, centers, directors, payableBills, expenseCategories: EXPENSE_CATEGORIES };
}

// The one place that actually applies a suspense transaction's money to a
// real record — used by both the single-transaction assign() form and
// bulkAssign() below, so the two can never drift apart. Performs the
// target record's side effects (update salary/rent/bill status, create an
// Expense) and creates the BankTransactionAssignment row. Returns
// { ok: true } or { ok: false, message } — never throws for a bad/missing
// target id, so callers (especially the bulk loop) can skip and continue.
async function applyAssignment(transaction, assignAmount, target, body, currentUser) {
  const base = {
    bank_transaction_id: transaction.id,
    amount: assignAmount,
    assigned_by: currentUser.id,
    assigned_at: new Date(),
  };

  if (target === 'trainer_salary') {
    const salary = await TrainerSalaryPayment.findByPk(body.trainer_salary_payment_id, { include: [{ model: Trainer, as: 'trainer' }] });
    if (!salary) return { ok: false, message: 'Please select a trainer salary record.' };

    const netPayable = Number(salary.amount) + Number(salary.bonus_amount) - Number(salary.deduction_amount);
    const newStatus = assignAmount >= netPayable ? 'paid' : 'partially_paid';
    await salary.update({ payment_date: transaction.transaction_date, payment_mode: 'bank_transfer', status: newStatus });

    await BankTransactionAssignment.create({
      ...base,
      category: 'Trainer Salary',
      trainer_salary_payment_id: salary.id,
      notes: `${salary.trainer.name} - ${salary.for_month}/${salary.for_year}`,
    });
  } else if (target === 'rent') {
    const rent = await RentPayment.findByPk(body.rent_payment_id, { include: [{ model: TrainingCenter, as: 'trainingCenter' }] });
    if (!rent) return { ok: false, message: 'Please select a centre rent record.' };

    const newAmountPaid = Number(rent.amount_paid) + assignAmount;
    const newStatus = newAmountPaid >= Number(rent.amount_due) ? 'paid' : 'pending';
    await rent.update({ amount_paid: newAmountPaid, payment_mode: 'bank_transfer', paid_date: transaction.transaction_date, status: newStatus });

    await BankTransactionAssignment.create({
      ...base,
      category: 'Centre Rent',
      rent_payment_id: rent.id,
      notes: `${rent.trainingCenter.name} - ${rent.for_month}/${rent.for_year}`,
    });
  } else if (target === 'expense') {
    if (!body.expense_category || !EXPENSE_CATEGORIES.includes(body.expense_category)) {
      return { ok: false, message: 'Please select a valid expense category.' };
    }
    const expense = await Expense.create({
      training_center_id: body.training_center_id || null,
      category: body.expense_category,
      description: body.expense_description || transaction.narration,
      amount: assignAmount,
      expense_date: transaction.transaction_date,
      recorded_by: currentUser.id,
    });

    await BankTransactionAssignment.create({
      ...base,
      category: body.expense_label || body.expense_category,
      expense_id: expense.id,
    });
  } else if (target === 'director_expense') {
    const director = await Director.findByPk(body.director_id);
    if (!director) return { ok: false, message: 'Please select a director.' };

    await BankTransactionAssignment.create({
      ...base,
      category: `Director Expense — ${director.name}`,
      director_id: director.id,
      notes: body.director_notes || null,
    });
  } else if (target === 'training_partner_payment') {
    const bill = await TrainingPartnerBill.findByPk(body.training_partner_bill_id, {
      include: [{ model: TrainingPartner, as: 'trainingPartner' }],
    });
    if (!bill || bill.status !== 'approved') return { ok: false, message: 'Please select an approved training partner bill.' };

    const remainingOnBill = Number(bill.net_amount) - Number(bill.amount_paid);
    if (assignAmount > remainingOnBill + 0.01) {
      return { ok: false, message: `This bill only has ₹${remainingOnBill.toLocaleString('en-IN')} remaining to pay.` };
    }

    const newAmountPaid = Number(bill.amount_paid) + assignAmount;
    const newStatus = newAmountPaid >= Number(bill.net_amount) ? 'paid' : bill.status;
    await bill.update({ amount_paid: newAmountPaid, status: newStatus });

    await BankTransactionAssignment.create({
      ...base,
      category: 'Training Partner Payment',
      training_partner_bill_id: bill.id,
      notes: `${bill.trainingPartner.name} - Bill #${bill.id} (${bill.period_from} to ${bill.period_to})`,
    });
  } else {
    return { ok: false, message: 'Please choose what to assign this transaction to.' };
  }

  return { ok: true };
}

async function show(req, res) {
  const transaction = await loadDetail(req.params.id);
  if (!transaction) return res.status(404).render('errors/404', { title: 'Not found' });

  res.render('suspense/show', {
    title: `Transaction #${transaction.id}`,
    transaction,
    amount: transactionAmount(transaction),
    assignedSoFar: assignedTotal(transaction.assignments),
  });
}

async function assignForm(req, res) {
  const transaction = await loadDetail(req.params.id);
  if (!transaction) return res.status(404).render('errors/404', { title: 'Not found' });

  const amount = transactionAmount(transaction);
  const assignedSoFar = assignedTotal(transaction.assignments);
  const remaining = Math.max(amount - assignedSoFar, 0);
  const options = await loadAssignOptions();

  res.render('suspense/assign', {
    title: 'Assign Transaction',
    transaction,
    amount,
    assignedSoFar,
    remaining,
    ...options,
    errors: null,
  });
}

async function assign(req, res) {
  const transaction = await BankTransaction.findByPk(req.params.id);
  if (!transaction) return res.status(404).render('errors/404', { title: 'Not found' });

  const amount = transactionAmount(transaction);
  const existingAssignments = await BankTransactionAssignment.findAll({ where: { bank_transaction_id: transaction.id } });
  const remaining = amount - assignedTotal(existingAssignments);

  const assignAmount = Number(req.body.amount);
  if (!assignAmount || assignAmount <= 0 || assignAmount > remaining + 0.01) {
    req.setFlash('error', `Enter an amount between ₹1 and the remaining unassigned amount (₹${remaining.toLocaleString('en-IN')}).`);
    return res.redirect(`/finance/suspense/${transaction.id}/assign`);
  }

  const target = req.body.target;
  const result = await applyAssignment(transaction, assignAmount, target, req.body, req.currentUser);
  if (!result.ok) {
    req.setFlash('error', result.message);
    return res.redirect(`/finance/suspense/${transaction.id}/assign`);
  }

  await recomputeStatus(transaction);
  await logAction(req, { action: 'assign', entityType: 'BankTransaction', entityId: transaction.id, newValue: { target, amount: assignAmount } });

  req.setFlash('success', 'Transaction assigned.');
  res.redirect(`/finance/suspense/${transaction.id}`);
}

// Applies ONE target/record to MANY selected transactions at once — each
// transaction's full remaining (unassigned) amount goes to that single
// target, e.g. three separate bank transfers that together paid off one
// month's rent. Skips (rather than fails the whole batch) any transaction
// that's already fully assigned/verified or that the target can't accept
// (e.g. exceeds a bill's remaining balance).
async function bulkAssign(req, res) {
  const ids = [].concat(req.body.transaction_ids || []).map((id) => parseInt(id, 10)).filter(Boolean);
  const target = req.body.target;

  if (ids.length === 0) {
    req.setFlash('error', 'Select at least one transaction first.');
    return res.redirect('/finance/suspense');
  }
  if (!target) {
    req.setFlash('error', 'Choose what to assign the selected transactions to.');
    return res.redirect('/finance/suspense');
  }

  let assignedCount = 0;
  let skippedCount = 0;
  let firstError = null;

  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const transaction = await BankTransaction.findByPk(id);
    if (!transaction || transaction.status === 'verified') {
      skippedCount += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const existingAssignments = await BankTransactionAssignment.findAll({ where: { bank_transaction_id: transaction.id } });
    const remaining = transactionAmount(transaction) - assignedTotal(existingAssignments);
    if (remaining <= 0.01) {
      skippedCount += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await applyAssignment(transaction, remaining, target, req.body, req.currentUser);
    if (!result.ok) {
      skippedCount += 1;
      if (!firstError) firstError = result.message;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await recomputeStatus(transaction);
    // eslint-disable-next-line no-await-in-loop
    await logAction(req, { action: 'assign', entityType: 'BankTransaction', entityId: transaction.id, newValue: { target, amount: remaining, bulk: true } });
    assignedCount += 1;
  }

  const parts = [];
  if (assignedCount > 0) parts.push(`Assigned ${assignedCount} transaction(s).`);
  if (skippedCount > 0) parts.push(`Skipped ${skippedCount}${firstError ? ` (${firstError})` : ' (already fully assigned or verified)'}.`);
  req.setFlash(assignedCount > 0 ? 'success' : 'error', parts.join(' ') || 'Nothing to assign.');
  res.redirect('/finance/suspense');
}

async function ignore(req, res) {
  const transaction = await BankTransaction.findByPk(req.params.id);
  if (!transaction) return res.status(404).render('errors/404', { title: 'Not found' });

  const oldValue = transaction.toJSON();
  await transaction.update({ status: 'ignored' });
  await logAction(req, { action: 'ignore', entityType: 'BankTransaction', entityId: transaction.id, oldValue, newValue: transaction.toJSON() });

  req.setFlash('success', 'Transaction marked as ignored.');
  res.redirect('/finance/suspense');
}

async function verify(req, res) {
  const transaction = await BankTransaction.findByPk(req.params.id, {
    include: [{ model: BankTransactionAssignment, as: 'assignments' }],
  });
  if (!transaction) return res.status(404).render('errors/404', { title: 'Not found' });

  if (transaction.status !== 'assigned') {
    req.setFlash('error', 'Only fully assigned transactions can be verified.');
    return res.redirect(`/finance/suspense/${transaction.id}`);
  }

  const now = new Date();
  await Promise.all(
    transaction.assignments.map((a) => a.update({ verified_by: req.currentUser.id, verified_at: now }))
  );
  await transaction.update({ status: 'verified' });

  await logAction(req, { action: 'verify', entityType: 'BankTransaction', entityId: transaction.id, newValue: { verified_by: req.currentUser.id } });

  req.setFlash('success', 'Transaction verified.');
  res.redirect(`/finance/suspense/${transaction.id}`);
}

// Permanently removes one suspense entry. Its BankTransactionAssignment
// rows cascade-delete automatically (onDelete: CASCADE on
// bank_transaction_id) — the Expense/TrainerSalaryPayment/RentPayment
// records those assignments pointed at are untouched, only the audit link
// documenting the match disappears.
async function destroy(req, res) {
  const transaction = await BankTransaction.findByPk(req.params.id);
  if (!transaction) return res.status(404).render('errors/404', { title: 'Not found' });

  await logAction(req, { action: 'delete', entityType: 'BankTransaction', entityId: transaction.id, oldValue: transaction.toJSON() });
  await transaction.destroy();

  req.setFlash('success', 'Transaction deleted.');
  res.redirect('/finance/suspense');
}

async function bulkDestroy(req, res) {
  const ids = [].concat(req.body.transaction_ids || []).map((id) => parseInt(id, 10)).filter(Boolean);
  if (ids.length === 0) {
    req.setFlash('error', 'Select at least one transaction first.');
    return res.redirect('/finance/suspense');
  }

  const transactions = await BankTransaction.findAll({ where: { id: ids } });
  await Promise.all(
    transactions.map((t) => logAction(req, { action: 'delete', entityType: 'BankTransaction', entityId: t.id, oldValue: t.toJSON() }))
  );
  const deletedCount = await BankTransaction.destroy({ where: { id: ids } });

  req.setFlash('success', `Deleted ${deletedCount} transaction(s).`);
  res.redirect('/finance/suspense');
}

module.exports = { show, assignForm, assign, bulkAssign, ignore, verify, destroy, bulkDestroy, loadAssignOptions };
