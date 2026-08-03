const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const studentController = require('../controllers/studentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('caste_category')
    .optional({ checkFalsy: true })
    .isIn(['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'])
    .withMessage('Invalid caste category'),
  body('aadhaar_number')
    .optional({ checkFalsy: true })
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Aadhaar number must be exactly 12 digits'),
];

router.get('/', studentController.index);
router.get('/new', requireRole('admin', 'manager', 'staff'), studentController.newForm);
router.post('/', requireRole('admin', 'manager', 'staff'), validators, studentController.create);
router.get('/:id', studentController.show);
router.get('/:id/edit', requireRole('admin', 'manager', 'staff'), studentController.editForm);
router.put('/:id', requireRole('admin', 'manager', 'staff'), validators, studentController.update);
router.delete('/:id', requireRole('admin', 'manager'), studentController.destroy);

module.exports = router;
