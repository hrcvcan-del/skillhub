const path = require('path');
const { BankAccount, BankStatementImport, BankTransaction } = require('../models');
const { getErrors } = require('../middleware/validate');
const { parseStatementFile } = require('../utils/bankStatementParser');

async function index(req, res) {
  const imports = await BankStatementImport.findAll({
    include: [{ model: BankAccount, as: 'bankAccount' }],
    order: [['created_at', 'DESC']],
  });
  res.render('bankStatements/index', { title: 'Bank Statement Uploads', imports });
}

async function uploadForm(req, res) {
  const accounts = await BankAccount.findAll({ where: { is_active: true }, order: [['bank_name', 'ASC']] });
  res.render('bankStatements/upload', { title: 'Upload Bank Statement', accounts, errors: null });
}

async function isDuplicate(bankAccountId, transaction) {
  const existing = await BankTransaction.findOne({
    where: {
      bank_account_id: bankAccountId,
      transaction_date: transaction.transaction_date,
      debit_amount: transaction.debit_amount,
      credit_amount: transaction.credit_amount,
    },
  });
  return !!existing;
}

async function upload(req, res) {
  const accounts = await BankAccount.findAll({ where: { is_active: true }, order: [['bank_name', 'ASC']] });
  const rerender = (formErrors) =>
    res.status(422).render('bankStatements/upload', { title: 'Upload Bank Statement', accounts, errors: formErrors });

  const errors = getErrors(req);
  if (errors) return rerender(errors);

  if (!req.file) {
    return rerender([{ field: 'file', message: 'Please choose a CSV, XLS, or XLSX file to upload' }]);
  }

  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const fileType = ['xls', 'xlsx', 'csv'].includes(ext) ? ext : 'csv';

  let parsed;
  try {
    parsed = parseStatementFile(req.file.path);
  } catch (err) {
    return rerender([{ field: 'file', message: `Could not read this file: ${err.message}` }]);
  }

  if (parsed.warning) {
    return rerender([{ field: 'file', message: parsed.warning }]);
  }
  if (parsed.transactions.length === 0) {
    return rerender([{ field: 'file', message: 'No transactions were found in this file.' }]);
  }

  const statementImport = await BankStatementImport.create({
    bank_account_id: req.body.bank_account_id,
    statement_from_date: req.body.statement_from_date || null,
    statement_to_date: req.body.statement_to_date || null,
    file_name: req.file.originalname,
    file_type: fileType,
    uploaded_by: req.currentUser.id,
    remarks: req.body.remarks || null,
    transaction_count: parsed.transactions.length,
  });

  let duplicateCount = 0;
  for (const txn of parsed.transactions) {
    // eslint-disable-next-line no-await-in-loop
    const dup = await isDuplicate(req.body.bank_account_id, txn);
    if (dup) duplicateCount += 1;

    // eslint-disable-next-line no-await-in-loop
    await BankTransaction.create({
      bank_account_id: req.body.bank_account_id,
      import_id: statementImport.id,
      transaction_date: txn.transaction_date,
      value_date: txn.value_date,
      narration: txn.narration,
      party_name: txn.party_name,
      reference_number: txn.reference_number,
      utr_number: txn.utr_number,
      debit_amount: txn.debit_amount,
      credit_amount: txn.credit_amount,
      closing_balance: txn.closing_balance,
      payment_mode: txn.payment_mode,
      status: dup ? 'duplicate' : 'unassigned',
    });
  }

  await statementImport.update({ duplicate_count: duplicateCount });

  req.setFlash(
    'success',
    `Imported ${parsed.transactions.length} transaction(s)` +
      (duplicateCount > 0 ? `, ${duplicateCount} flagged as possible duplicates.` : '.')
  );
  res.redirect('/finance/suspense');
}

// Deletes an entire imported statement and every transaction it brought
// in. bank_transactions.import_id is onDelete:SET NULL (not CASCADE) —
// deleting the import alone would just orphan its transactions in the
// Suspense register, not remove them — so the transactions are deleted
// explicitly first. Each transaction's assignments cascade-delete
// automatically (see bankTransactionController.destroy).
async function destroy(req, res) {
  const statementImport = await BankStatementImport.findByPk(req.params.id);
  if (!statementImport) return res.status(404).render('errors/404', { title: 'Not found' });

  const transactionCount = await BankTransaction.count({ where: { import_id: statementImport.id } });
  // A single bulk DELETE — the CASCADE on bank_transaction_assignments'
  // FK is enforced by Postgres regardless of how many rows it affects.
  await BankTransaction.destroy({ where: { import_id: statementImport.id } });

  await statementImport.destroy();

  req.setFlash('success', `Deleted the statement and ${transactionCount} transaction(s).`);
  res.redirect('/finance/bank-statements');
}

module.exports = { index, uploadForm, upload, destroy };
