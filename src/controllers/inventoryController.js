const { Op } = require('sequelize');
const { EquipmentInventory, TrainingCenter } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { buildPagination } = require('../utils/listQuery');

const CONDITIONS = ['new', 'good', 'needs_repair', 'damaged', 'disposed'];
const WARRANTY_ALERT_DAYS = 30;

function pickFields(body) {
  return {
    training_center_id: body.training_center_id,
    name: body.name,
    category: body.category || null,
    quantity: body.quantity || 1,
    unit_purchase_cost: body.unit_purchase_cost || 0,
    purchase_date: body.purchase_date || null,
    vendor_name: body.vendor_name || null,
    condition: body.condition || 'new',
    warranty_expiry_date: body.warranty_expiry_date || null,
    serial_number: body.serial_number || null,
    notes: body.notes || null,
    last_maintenance_date: body.last_maintenance_date || null,
  };
}

async function index(req, res) {
  const where = {};
  if (req.query.center_id) where.training_center_id = req.query.center_id;
  if (req.query.condition) where.condition = req.query.condition;

  const total = await EquipmentInventory.count({ where });
  const pagination = buildPagination(req, total);
  const items = await EquipmentInventory.findAll({
    where,
    include: [{ model: TrainingCenter, as: 'trainingCenter' }],
    order: [['name', 'ASC']],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const warrantyThreshold = new Date();
  warrantyThreshold.setDate(warrantyThreshold.getDate() + WARRANTY_ALERT_DAYS);
  const today = new Date().toISOString().slice(0, 10);

  const [needsAttentionCount, warrantyExpiringCount] = await Promise.all([
    EquipmentInventory.count({ where: { condition: ['needs_repair', 'damaged'] } }),
    EquipmentInventory.count({
      where: {
        warranty_expiry_date: { [Op.gte]: today, [Op.lte]: warrantyThreshold.toISOString().slice(0, 10) },
      },
    }),
  ]);

  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });

  res.render('inventory/index', {
    title: 'Equipment Inventory',
    items,
    centers,
    conditions: CONDITIONS,
    filters: { center_id: req.query.center_id || '', condition: req.query.condition || '' },
    needsAttentionCount,
    warrantyExpiringCount,
    warrantyAlertDays: WARRANTY_ALERT_DAYS,
    pagination,
  });
}

async function valuationReport(req, res) {
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });
  const items = await EquipmentInventory.findAll();

  const byCenter = centers.map((center) => {
    const centerItems = items.filter((i) => i.training_center_id === center.id);
    const totalValue = centerItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_purchase_cost), 0);
    const totalUnits = centerItems.reduce((sum, i) => sum + Number(i.quantity), 0);
    return { center, totalValue, totalUnits, itemCount: centerItems.length };
  });

  const grandTotal = byCenter.reduce((sum, c) => sum + c.totalValue, 0);

  res.render('inventory/valuation', { title: 'Inventory Valuation', byCenter, grandTotal });
}

async function newForm(req, res) {
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  res.render('inventory/form', { title: 'New Equipment', item: {}, errors: null, centers, conditions: CONDITIONS });
}

async function create(req, res) {
  const errors = getErrors(req);
  const centers = await TrainingCenter.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

  if (errors) {
    return res.status(422).render('inventory/form', { title: 'New Equipment', item: req.body, errors, centers, conditions: CONDITIONS });
  }

  const item = await EquipmentInventory.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'EquipmentInventory', entityId: item.id, newValue: item.toJSON() });

  req.setFlash('success', 'Equipment added.');
  res.redirect('/inventory');
}

async function editForm(req, res) {
  const item = await EquipmentInventory.findByPk(req.params.id);
  if (!item) return res.status(404).render('errors/404', { title: 'Not found' });
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });
  res.render('inventory/form', { title: 'Edit Equipment', item, errors: null, centers, conditions: CONDITIONS });
}

async function update(req, res) {
  const item = await EquipmentInventory.findByPk(req.params.id);
  if (!item) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  const centers = await TrainingCenter.findAll({ order: [['name', 'ASC']] });
  if (errors) {
    return res.status(422).render('inventory/form', {
      title: 'Edit Equipment',
      item: { ...item.toJSON(), ...req.body },
      errors,
      centers,
      conditions: CONDITIONS,
    });
  }

  const oldValue = item.toJSON();
  await item.update(pickFields(req.body));
  await logAction(req, { action: 'update', entityType: 'EquipmentInventory', entityId: item.id, oldValue, newValue: item.toJSON() });

  req.setFlash('success', 'Equipment updated.');
  res.redirect('/inventory');
}

async function destroy(req, res) {
  const item = await EquipmentInventory.findByPk(req.params.id);
  if (!item) return res.status(404).render('errors/404', { title: 'Not found' });

  await logAction(req, { action: 'delete', entityType: 'EquipmentInventory', entityId: item.id, oldValue: item.toJSON() });
  await item.destroy();

  req.setFlash('success', 'Equipment deleted.');
  res.redirect('/inventory');
}

module.exports = { index, valuationReport, newForm, create, editForm, update, destroy, CONDITIONS };
