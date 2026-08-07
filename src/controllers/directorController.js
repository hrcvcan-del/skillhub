const { Director } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');

async function index(req, res) {
  const directors = await Director.findAll({ order: [['name', 'ASC']] });
  res.render('directors/index', { title: 'Directors', directors, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    const directors = await Director.findAll({ order: [['name', 'ASC']] });
    req.setFlash('error', errors.map((e) => e.message).join(', '));
    return res.redirect('/directors');
  }

  const director = await Director.create({ name: req.body.name, notes: req.body.notes || null });
  await logAction(req, { action: 'create', entityType: 'Director', entityId: director.id, newValue: director.toJSON() });

  req.setFlash('success', `Director "${director.name}" added.`);
  res.redirect('/directors');
}

async function update(req, res) {
  const director = await Director.findByPk(req.params.id);
  if (!director) return res.status(404).render('errors/404', { title: 'Not found' });

  const oldValue = director.toJSON();
  await director.update({
    name: req.body.name,
    notes: req.body.notes || null,
    is_active: req.body.is_active === 'on' || req.body.is_active === 'true',
  });
  await logAction(req, { action: 'update', entityType: 'Director', entityId: director.id, oldValue, newValue: director.toJSON() });

  req.setFlash('success', 'Director updated.');
  res.redirect('/directors');
}

module.exports = { index, create, update };
