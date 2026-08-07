const { Op } = require('sequelize');
const { BankTransaction, BankAccount, BankTransactionAssignment } = require('../models');
const { buildPagination } = require('../utils/listQuery');
const { suggestCategory } = require('../utils/suspenseSuggestions');
const { loadAssignOptions } = require('./bankTransactionController');

function buildWhere(query) {
  const where = {};
  if (query.bank_account_id) where.bank_account_id = query.bank_account_id;
  if (query.status) where.status = query.status;
  if (query.type === 'debit') where.debit_amount = { [Op.gt]: 0 };
  if (query.type === 'credit') where.credit_amount = { [Op.gt]: 0 };
  if (query.from || query.to) {
    where.transaction_date = {};
    if (query.from) where.transaction_date[Op.gte] = query.from;
    if (query.to) where.transaction_date[Op.lte] = query.to;
  }
  if (query.q) {
    where[Op.or] = [
      { narration: { [Op.iLike]: `%${query.q}%` } },
      { party_name: { [Op.iLike]: `%${query.q}%` } },
      { utr_number: { [Op.iLike]: `%${query.q}%` } },
      { reference_number: { [Op.iLike]: `%${query.q}%` } },
    ];
  }
  return where;
}

async function index(req, res) {
  const where = buildWhere(req.query);

  const total = await BankTransaction.count({ where });
  const pagination = buildPagination(req, total, 25);
  const transactions = await BankTransaction.findAll({
    where,
    include: [
      { model: BankAccount, as: 'bankAccount' },
      { model: BankTransactionAssignment, as: 'assignments' },
    ],
    order: [['transaction_date', 'DESC'], ['id', 'DESC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const summary = {
    totalDebit: await BankTransaction.sum('debit_amount', { where }),
    totalCredit: await BankTransaction.sum('credit_amount', { where }),
  };

  const bankAccounts = await BankAccount.findAll({ order: [['bank_name', 'ASC']] });
  const assignOptions = await loadAssignOptions();

  const rows = transactions.map((t) => ({
    transaction: t,
    suggestedCategory: t.status === 'unassigned' ? suggestCategory(t) : null,
    assignedTotal: t.assignments.reduce((sum, a) => sum + Number(a.amount), 0),
  }));

  res.render('suspense/index', {
    title: 'Suspense Transactions',
    rows,
    bankAccounts,
    ...assignOptions,
    summary: {
      totalDebit: summary.totalDebit || 0,
      totalCredit: summary.totalCredit || 0,
    },
    filters: {
      bank_account_id: req.query.bank_account_id || '',
      status: req.query.status || '',
      type: req.query.type || '',
      from: req.query.from || '',
      to: req.query.to || '',
      q: req.query.q || '',
    },
    pagination,
  });
}

module.exports = { index, buildWhere };
