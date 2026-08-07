// Builds the filtered "All Assigned Entries" Excel export — every
// suspense-assignment row (money actually matched to a real record),
// across every category, for Finance Director/Master Admin.
const XLSX = require('xlsx');
const { toDDMMYYYY } = require('./reportDate');

const HEADERS = [
  'Date', 'Bank', 'Category', 'Linked To', 'Amount', 'Assigned By', 'Assigned On', 'Verified',
];

function linkedToLabel(a) {
  if (a.trainerSalaryPayment) {
    return `${a.trainerSalaryPayment.trainer.name} (${a.trainerSalaryPayment.for_month}/${a.trainerSalaryPayment.for_year})`;
  }
  if (a.rentPayment) {
    return `${a.rentPayment.trainingCenter.name} (${a.rentPayment.for_month}/${a.rentPayment.for_year})`;
  }
  if (a.director) return a.director.name;
  if (a.trainingPartnerBill) return `${a.trainingPartnerBill.trainingPartner.name} - Bill #${a.trainingPartnerBill.id}`;
  if (a.expense) return a.expense.category.replace(/_/g, ' ');
  return '-';
}

function buildAssignmentReportWorkbook(assignments) {
  const rows = [HEADERS];

  assignments.forEach((a) => {
    rows.push([
      toDDMMYYYY(a.bankTransaction.transaction_date),
      a.bankTransaction.bankAccount ? a.bankTransaction.bankAccount.bank_name : '',
      a.category,
      linkedToLabel(a),
      Number(a.amount),
      a.assignedByUser ? a.assignedByUser.name : '',
      a.assigned_at ? toDDMMYYYY(new Date(a.assigned_at).toISOString().slice(0, 10)) : '',
      a.verified_by ? 'Yes' : 'No',
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildAssignmentReportWorkbook };
