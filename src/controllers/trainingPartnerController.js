const { TrainingPartner } = require('../models');
const { getErrors } = require('../middleware/validate');
const { logAction } = require('../middleware/audit');
const { getOwnTrainingPartnerId } = require('../utils/trainingPartnerScope');

function pickFields(body) {
  return {
    name: body.name,
    account_number: body.account_number || null,
    bank_name: body.bank_name || null,
    ifsc_code: body.ifsc_code || null,
    address: body.address || null,
    contact_person: body.contact_person || null,
    contact_phone: body.contact_phone || null,
    contact_email: body.contact_email || null,
  };
}

// Finance Director's list of every training partner.
async function index(req, res) {
  const partners = await TrainingPartner.findAll({ order: [['name', 'ASC']] });
  res.render('trainingPartners/index', { title: 'Training Partners', partners });
}

function newForm(req, res) {
  res.render('trainingPartners/form', { title: 'New Training Partner', partner: {}, errors: null });
}

async function create(req, res) {
  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('trainingPartners/form', { title: 'New Training Partner', partner: req.body, errors });
  }

  const partner = await TrainingPartner.create(pickFields(req.body));
  await logAction(req, { action: 'create', entityType: 'TrainingPartner', entityId: partner.id, newValue: partner.toJSON() });

  req.setFlash('success', `${partner.name} added. Create their login under Users, role "Training Partner", linked to this record.`);
  res.redirect('/training-partners');
}

// Shared by finance_director (editing any partner via the URL id) and the
// training_partner role itself (always forced to their own record,
// regardless of what's in the URL — see getOwnTrainingPartnerId).
async function editForm(req, res) {
  const ownId = getOwnTrainingPartnerId(req.currentUser);
  const id = ownId || req.params.id;
  const partner = await TrainingPartner.findByPk(id);
  if (!partner) return res.status(404).render('errors/404', { title: 'Not found' });

  res.render('trainingPartners/form', { title: 'Edit Training Partner', partner, errors: null, selfService: !!ownId });
}

async function update(req, res) {
  const ownId = getOwnTrainingPartnerId(req.currentUser);
  const id = ownId || req.params.id;
  const partner = await TrainingPartner.findByPk(id);
  if (!partner) return res.status(404).render('errors/404', { title: 'Not found' });

  const errors = getErrors(req);
  if (errors) {
    return res.status(422).render('trainingPartners/form', {
      title: 'Edit Training Partner',
      partner: { ...partner.toJSON(), ...req.body },
      errors,
      selfService: !!ownId,
    });
  }

  const oldValue = partner.toJSON();
  const updateFields = pickFields(req.body);
  if (!ownId) {
    // Only Finance Director can flip active/inactive — a partner editing
    // their own profile can't deactivate themselves.
    updateFields.is_active = req.body.is_active === 'on' || req.body.is_active === 'true';
  }
  await partner.update(updateFields);
  await logAction(req, { action: 'update', entityType: 'TrainingPartner', entityId: partner.id, oldValue, newValue: partner.toJSON() });

  req.setFlash('success', 'Training partner profile updated.');
  res.redirect(ownId ? '/training-partners/profile' : '/training-partners');
}

module.exports = { index, newForm, create, editForm, update };
