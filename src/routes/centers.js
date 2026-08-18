const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const centerController = require('../controllers/centerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ADMIN_ROLES } = require('../utils/roles');
const upload = require('../config/upload');

// Full manage (view/edit/bulk-upload/delete) — deliberately does NOT
// include center_coordinator/center_manager/training_center, who each get
// a narrower slice below.
const manageRoles = [...ADMIN_ROLES, 'manager'];
// Who can create a new center: everyone in manageRoles, plus
// center_coordinator and center_manager — both of whom can add a center but
// can't browse the list or view/edit any center's details (see
// blockCreateOnlyView below). training_center is deliberately NOT included
// here — that role manages batches/students at a center already assigned
// to it, not centers themselves.
const createRoles = [...manageRoles, 'center_coordinator', 'center_manager'];

router.use(requireAuth);

// center_coordinator gets exactly one door into this module: "add a new
// center" — viewing the list or any center's detail page is blocked
// outright, even though every other authenticated role can browse both
// with no restriction. training_center has no door into this module at
// all. center_manager used to be just as narrow, but now also needs
// list/view access so they have somewhere to navigate from before editing
// a center's details (name, bank details, etc. — see editRoles below).
function blockCreateOnlyView(req, res, next) {
  if (['center_coordinator', 'training_center'].includes(req.currentUser.role)) {
    return res.status(403).render('errors/403', { title: 'Access denied' });
  }
  next();
}

// center_manager can edit an existing center's details (what it was
// missing before — previously add-only) but stays out of bulk-upload and
// Delete, which are still admin/director/manager only via manageRoles.
const editRoles = [...manageRoles, 'center_manager'];

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('monthly_rent_amount').isFloat({ min: 0 }).withMessage('Monthly rent must be a positive number'),
  body('capacity').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Capacity must be a positive integer'),
];

// Placed before "/:id" so "bulk-upload" isn't swallowed by the id param route.
router.get('/bulk-upload', requireRole(...manageRoles), centerController.bulkUploadForm);
router.get('/bulk-upload/template', requireRole(...manageRoles), centerController.downloadTemplate);
router.post('/bulk-upload', requireRole(...manageRoles), upload.statementUpload.single('file'), centerController.bulkUpload);

router.get('/', blockCreateOnlyView, centerController.index);
router.get('/new', requireRole(...createRoles), centerController.newForm);
router.post('/', requireRole(...createRoles), validators, centerController.create);
router.get('/:id', blockCreateOnlyView, centerController.show);
router.get('/:id/edit', requireRole(...editRoles), centerController.editForm);
router.put('/:id', requireRole(...editRoles), validators, centerController.update);
router.delete('/:id', requireRole(...ADMIN_ROLES), centerController.destroy);

module.exports = router;
