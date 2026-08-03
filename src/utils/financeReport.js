const { Op } = require('sequelize');
const {
  FeePayment,
  Enrollment,
  Batch,
  Expense,
  RentPayment,
  TrainerSalaryPayment,
  TrainingCenter,
  EquipmentInventory,
  Trainer,
} = require('../models');

const EXPENSE_CATEGORIES = ['utilities', 'marketing', 'maintenance', 'supplies', 'travel', 'salaries_admin', 'misc'];

function monthRange(month, year) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

async function getIncome(month, year, centerId) {
  const { start, end } = monthRange(month, year);
  const batchWhere = centerId ? { training_center_id: centerId } : undefined;

  const payments = await FeePayment.findAll({
    where: { payment_date: { [Op.between]: [start, end] } },
    include: [
      {
        model: Enrollment,
        as: 'enrollment',
        required: true,
        include: [{ model: Batch, as: 'batch', required: true, where: batchWhere }],
      },
    ],
  });

  return payments.reduce((sum, p) => sum + Number(p.amount), 0);
}

async function getRentExpense(month, year, centerId) {
  const where = { for_month: month, for_year: year };
  if (centerId) where.training_center_id = centerId;
  const total = await RentPayment.sum('amount_due', { where });
  return total || 0;
}

async function getSalaryExpense(month, year, centerId) {
  const where = { for_month: month, for_year: year };
  if (centerId) where.training_center_id = centerId;
  const payments = await TrainerSalaryPayment.findAll({ where });
  return payments.reduce((sum, p) => sum + Number(p.amount) + Number(p.bonus_amount) - Number(p.deduction_amount), 0);
}

async function getMiscExpense(month, year, centerId) {
  const { start, end } = monthRange(month, year);
  const where = { expense_date: { [Op.between]: [start, end] } };
  if (centerId) where.training_center_id = centerId;
  const total = await Expense.sum('amount', { where });
  return total || 0;
}

async function getPeriodTotals(month, year, centerId) {
  const [income, rentExpense, salaryExpense, miscExpense] = await Promise.all([
    getIncome(month, year, centerId),
    getRentExpense(month, year, centerId),
    getSalaryExpense(month, year, centerId),
    getMiscExpense(month, year, centerId),
  ]);

  const totalExpense = rentExpense + salaryExpense + miscExpense;
  return {
    income,
    rentExpense,
    salaryExpense,
    miscExpense,
    totalExpense,
    net: income - totalExpense,
  };
}

async function getMonthlyTrend(monthsBack, centerId) {
  const now = new Date();
  const results = [];

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const totals = await getPeriodTotals(month, year, centerId);
    results.push({
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      income: totals.income,
      expense: totals.totalExpense,
    });
  }

  return results;
}

async function getExpenseByCategory(month, year, centerId) {
  const { start, end } = monthRange(month, year);
  const where = { expense_date: { [Op.between]: [start, end] } };
  if (centerId) where.training_center_id = centerId;

  const results = await Promise.all(
    EXPENSE_CATEGORIES.map(async (category) => {
      const total = await Expense.sum('amount', { where: { ...where, category } });
      return { category, amount: total || 0 };
    })
  );

  return results.filter((r) => r.amount > 0);
}

async function getPerCenterComparison(month, year) {
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  return Promise.all(
    centers.map(async (center) => {
      const totals = await getPeriodTotals(month, year, center.id);
      return { center: center.name, income: totals.income, expense: totals.totalExpense };
    })
  );
}

async function getUpcomingDues() {
  const today = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().slice(0, 10);
  const weekFromNowStr = weekFromNow.toISOString().slice(0, 10);

  const monthFromNow = new Date();
  monthFromNow.setDate(today.getDate() + 30);

  const [rentDueSoon, salariesPending, equipmentAlerts] = await Promise.all([
    RentPayment.findAll({
      where: {
        status: ['pending', 'overdue'],
        due_date: { [Op.lte]: weekFromNowStr },
      },
      include: [{ model: TrainingCenter, as: 'trainingCenter' }],
      order: [['due_date', 'ASC']],
      limit: 10,
    }),
    TrainerSalaryPayment.findAll({
      where: { status: ['pending', 'partially_paid'], for_month: today.getMonth() + 1, for_year: today.getFullYear() },
      include: [{ model: Trainer, as: 'trainer' }],
      limit: 10,
    }),
    EquipmentInventory.findAll({
      where: {
        [Op.or]: [
          { condition: ['needs_repair', 'damaged'] },
          { warranty_expiry_date: { [Op.gte]: todayStr, [Op.lte]: monthFromNow.toISOString().slice(0, 10) } },
        ],
      },
      include: [{ model: TrainingCenter, as: 'trainingCenter' }],
      limit: 10,
    }),
  ]);

  return { rentDueSoon, salariesPending, equipmentAlerts };
}

module.exports = {
  getPeriodTotals,
  getMonthlyTrend,
  getExpenseByCategory,
  getPerCenterComparison,
  getUpcomingDues,
  EXPENSE_CATEGORIES,
};
