const {
  BankTransaction,
  BankAccount,
  BankTransactionAssignment,
  TrainerSalaryPayment,
  Trainer,
  RentPayment,
  TrainingCenter,
  Expense,
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
          { model: User, as: 'assignedByUser' },
          { model: User, as: 'verifiedByUser' },
        ],
      },
    ],
  });
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

  const [pendingSalaries, pendingRents, centers] = await Promise.all([
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
  ]);

  res.render('suspense/assign', {
    title: 'Assign Transaction',
    transaction,
    amount,
    assignedSoFar,
    remaining,
    pendingSalaries,
    pendingRents,
    centers,
    expenseCategories: EXPENSE_CATEGORIES,
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

  const target = req.body.target; // 'trainer_salary' | 'rent' | 'expense'
  const base = {
    bank_transaction_id: transaction.id,
    amount: assignAmount,
    assigned_by: req.currentUser.id,
    assigned_at: new Date(),
  };

  if (target === 'trainer_salary') {
    const salary = await TrainerSalaryPayment.findByPk(req.body.trainer_salary_payment_id, { include: [{ model: Trainer, as: 'trainer' }] });
    if (!salary) {
      req.setFlash('error', 'Please select a trainer salary record.');
      return res.redirect(`/finance/suspense/${transaction.id}/assign`);
    }
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
    const rent = await RentPayment.findByPk(req.body.rent_payment_id, { include: [{ model: TrainingCenter, as: 'trainingCenter' }] });
    if (!rent) {
      req.setFlash('error', 'Please select a centre rent record.');
      return res.redirect(`/finance/suspense/${transaction.id}/assign`);
    }
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
    if (!req.body.expense_category || !EXPENSE_CATEGORIES.includes(req.body.expense_category)) {
      req.setFlash('error', 'Please select a valid expense category.');
      return res.redirect(`/finance/suspense/${transaction.id}/assign`);
    }
    const expense = await Expense.create({
      training_center_id: req.body.training_center_id || null,
      category: req.body.expense_category,
      description: req.body.expense_description || transaction.narration,
      amount: assignAmount,
      expense_date: transaction.transaction_date,
      recorded_by: req.currentUser.id,
    });

    await BankTransactionAssignment.create({
      ...base,
      category: req.body.expense_label || req.body.expense_category,
      expense_id: expense.id,
    });
  } else {
    req.setFlash('error', 'Please choose what to assign this transaction to.');
    return res.redirect(`/finance/suspense/${transaction.id}/assign`);
  }

  await recomputeStatus(transaction);
  await logAction(req, { action: 'assign', entityType: 'BankTransaction', entityId: transaction.id, newValue: { target, amount: assignAmount } });

  req.setFlash('success', 'Transaction assigned.');
  res.redirect(`/finance/suspense/${transaction.id}`);
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

module.exports = { show, assignForm, assign, ignore, verify };
