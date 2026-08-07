const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const batchController = require('../controllers/batchController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const validators = [
  body('course_id').isInt().withMessage('Course is required'),
  body('training_center_id').isInt().withMessage('Training center is required'),
  body('start_date').isISO8601().withMessage('Start date is required'),
  body('end_date').isISO8601().withMessage('End date is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
];

const writeRoles = ['admin', 'manager', 'staff', 'center_coordinator'];

router.get('/', batchController.index);
router.get('/new', requireRole(...writeRoles), batchController.newForm);
router.post('/', requireRole(...writeRoles), validators, batchController.create);
router.get('/:id', batchController.show);
router.get('/:id/edit', requireRole(...writeRoles), batchController.editForm);
router.put('/:id', requireRole(...writeRoles), validators, batchController.update);
router.delete('/:id', requireRole('admin', 'manager'), batchController.destroy);

router.get('/:id/export/joining', batchController.exportJoiningExcel);
router.get('/:id/export/commencement', batchController.exportCommencementLetter);
router.get('/:id/export/feedback', batchController.exportFeedbackLetter);

module.exports = router;
