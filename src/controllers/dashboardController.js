const { TrainingCenter, Batch, Student, Enrollment } = require('../models');
const financeReport = require('../utils/financeReport');
const { sendCsv } = require('../utils/csv');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function resolvePeriod(req) {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const centerId = req.query.center_id || null;
  return { month, year, centerId };
}

async function index(req, res) {
  const [centerCount, activeBatchCount, studentCount, activeEnrollmentCount] = await Promise.all([
    TrainingCenter.count({ where: { is_active: true } }),
    Batch.count({ where: { status: ['upcoming', 'ongoing'] } }),
    Student.count(),
    Enrollment.count({ where: { status: 'active' } }),
  ]);

  const stats = { centerCount, activeBatchCount, studentCount, activeEnrollmentCount };
  const canViewFinance = ['admin', 'manager'].includes(req.currentUser.role);

  if (!canViewFinance) {
    return res.render('dashboard/index', { title: 'Dashboard', stats, canViewFinance, finance: null });
  }

  const { month, year, centerId } = resolvePeriod(req);
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  const [totals, trend, byCategory, byCenter, upcomingDues] = await Promise.all([
    financeReport.getPeriodTotals(month, year, centerId),
    financeReport.getMonthlyTrend(6, centerId),
    financeReport.getExpenseByCategory(month, year, centerId),
    financeReport.getPerCenterComparison(month, year),
    financeReport.getUpcomingDues(),
  ]);

  res.render('dashboard/index', {
    title: 'Dashboard',
    stats,
    canViewFinance,
    finance: {
      totals,
      trend,
      byCategory,
      byCenter,
      upcomingDues,
      period: { month, year, centerId: centerId || '' },
      centers,
      monthNames: MONTH_NAMES,
    },
  });
}

async function exportCsv(req, res) {
  const { month, year, centerId } = resolvePeriod(req);
  const totals = await financeReport.getPeriodTotals(month, year, centerId);

  sendCsv(
    res,
    `pnl-${year}-${String(month).padStart(2, '0')}.csv`,
    [
      { label: 'Income (fees collected)', value: totals.income },
      { label: 'Rent Expense', value: totals.rentExpense },
      { label: 'Trainer Salary Expense', value: totals.salaryExpense },
      { label: 'Other Expenses', value: totals.miscExpense },
      { label: 'Total Expense', value: totals.totalExpense },
      { label: 'Net Profit/Loss', value: totals.net },
    ],
    [
      { label: 'Metric', value: (r) => r.label },
      { label: 'Amount', value: (r) => r.value },
    ]
  );
}

module.exports = { index, exportCsv };
