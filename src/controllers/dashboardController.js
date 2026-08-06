const { Op } = require('sequelize');
const { TrainingCenter, Batch, Student, Enrollment, Expense, User, Course, Trainer } = require('../models');
const financeReport = require('../utils/financeReport');
const { sendCsv } = require('../utils/csv');
const { ADMIN_ROLES } = require('../utils/roles');
const { getScopedCenterIds, getStudentIdsAtCenters, centerIdsWhereValue, NO_MATCH_ID } = require('../utils/centerScope');
const { syncBatchStatus } = require('../utils/batchStatus');

const CLOSURE_ALERT_DAYS = 15;

async function getCentersClosingSoon() {
  const today = new Date().toISOString().slice(0, 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + CLOSURE_ALERT_DAYS);

  return TrainingCenter.findAll({
    where: {
      is_active: true,
      planned_closure_date: { [Op.gte]: today, [Op.lte]: threshold.toISOString().slice(0, 10) },
    },
    include: [{ model: User, as: 'coordinator' }],
    order: [['planned_closure_date', 'ASC']],
  });
}

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

// Admin/Director/Manager (and any role not covered by the two dedicated
// dashboards below) land on the institute-wide overview: today's original
// dashboard, unchanged.
async function renderOverallDashboard(req, res) {
  const [centerCount, activeBatchCount, studentCount, activeEnrollmentCount, centersClosingSoon] = await Promise.all([
    TrainingCenter.count({ where: { is_active: true } }),
    Batch.count({ where: { status: ['upcoming', 'ongoing'] } }),
    Student.count(),
    Enrollment.count({ where: { status: 'active' } }),
    getCentersClosingSoon(),
  ]);

  const stats = { centerCount, activeBatchCount, studentCount, activeEnrollmentCount };
  const canViewFinance = [...ADMIN_ROLES, 'manager'].includes(req.currentUser.role);

  if (!canViewFinance) {
    return res.render('dashboard/index', {
      title: 'Dashboard',
      stats,
      canViewFinance,
      finance: null,
      centersClosingSoon,
      closureAlertDays: CLOSURE_ALERT_DAYS,
    });
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
    centersClosingSoon,
    closureAlertDays: CLOSURE_ALERT_DAYS,
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

// Accountant lands directly on the institute-wide finance view (the same
// data the Overall Dashboard shows admins, minus the center/student/batch
// counts and closure alerts that aren't their concern).
async function renderFinanceDashboard(req, res) {
  const { month, year, centerId } = resolvePeriod(req);
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  const [totals, trend, byCategory, byCenter, upcomingDues] = await Promise.all([
    financeReport.getPeriodTotals(month, year, centerId),
    financeReport.getMonthlyTrend(6, centerId),
    financeReport.getExpenseByCategory(month, year, centerId),
    financeReport.getPerCenterComparison(month, year),
    financeReport.getUpcomingDues(),
  ]);

  res.render('dashboard/finance', {
    title: 'Finance Dashboard',
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

// Center Coordinator lands on a dashboard scoped to only the center(s)
// they coordinate (TrainingCenter.coordinator_id), per the Center Staff
// role in the login workflow diagram.
async function renderCenterDashboard(req, res) {
  const centerIds = await getScopedCenterIds(req.currentUser);
  const myCenters = await TrainingCenter.findAll({
    where: { id: centerIdsWhereValue(centerIds), is_active: true },
    order: [['name', 'ASC']],
  });

  if (myCenters.length === 0) {
    return res.render('dashboard/center', {
      title: 'Center Dashboard',
      unassigned: true,
      myCenters: [],
      stats: null,
      batches: [],
      recentExpenses: [],
    });
  }

  const scopedCenterIds = myCenters.map((c) => c.id);
  const batchWhere = { training_center_id: scopedCenterIds, status: ['upcoming', 'ongoing'] };

  const [batchCount, studentIds, recentExpenses, batches] = await Promise.all([
    Batch.count({ where: batchWhere }),
    getStudentIdsAtCenters(scopedCenterIds),
    Expense.findAll({
      where: { training_center_id: scopedCenterIds },
      include: [{ model: TrainingCenter, as: 'trainingCenter' }],
      order: [['expense_date', 'DESC']],
      limit: 8,
    }),
    Batch.findAll({
      where: batchWhere,
      include: [
        { model: Course, as: 'course' },
        { model: TrainingCenter, as: 'trainingCenter' },
        { model: Trainer, as: 'trainer' },
      ],
      order: [['start_date', 'ASC']],
      limit: 10,
    }),
  ]);

  await Promise.all(batches.map(syncBatchStatus));

  const activeEnrollmentCount = await Enrollment.count({
    where: { status: 'active', student_id: studentIds.length === 0 ? NO_MATCH_ID : studentIds },
  });

  const stats = {
    centerCount: myCenters.length,
    activeBatchCount: batchCount,
    studentCount: studentIds.length,
    activeEnrollmentCount,
  };

  res.render('dashboard/center', {
    title: 'Center Dashboard',
    unassigned: false,
    myCenters,
    stats,
    batches,
    recentExpenses,
  });
}

async function index(req, res) {
  const { role } = req.currentUser;
  if (role === 'center_coordinator') return renderCenterDashboard(req, res);
  if (role === 'accountant') return renderFinanceDashboard(req, res);
  return renderOverallDashboard(req, res);
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
