const { BankAccount } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');

function pickFields(body) {
  return {
    bank_name: body.bank_name,
    account_name: body.account_name,
    account_number: body.account_number,
    ifsc_code: body.ifsc_code || null,
    is_active: body.is_active === 'on' || body.is_active === 'true' || body.is_active === undefined,
  };
}

async function index(req, res) {
  const accounts = await BankAccount.findAll({ order: [['bank_name', 'ASC']] });
  res.render('bankAccounts/index', { title: 'Bank Accounts', accounts });
}

function newForm(req, res) {
  res.render('bankAccounts/form', { title: 'New Bank Account', account: {}, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('bankAccounts/form', { title: 'New Bank Account', account: req.body, errors });
  }

  const account = await BankAccount.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'BankAccount', entityId: account.id, newValue: account.toJSON() });

  req.setFlash('success', 'Bank account added.');
  res.redirect('/finance/bank-accounts');
}

async function editForm(req, res) {
  const account = await BankAccount.findByPk(req.params.id);
  if (!account) return res.status(404).render('errors/404', { title: 'Not found' });
  res.render('bankAccounts/form', { title: 'Edit Bank Account', account, errors: null });
}

async function update(req, res) {
  const account = await BankAccount.findByPk(req.params.id);
  if (!account) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('bankAccounts/form', {
      title: 'Edit Bank Account',
      account: { ...account.toJSON(), ...req.body },
      errors,
    });
  }

  const oldValue = account.toJSON();
  await account.update(pickFields(req.body));
  await logAction(req, { action: 'update', entityType: 'BankAccount', entityId: account.id, oldValue, newValue: account.toJSON() });

  req.setFlash('success', 'Bank account updated.');
  res.redirect('/finance/bank-accounts');
}

module.exports = { index, newForm, create, editForm, update };
