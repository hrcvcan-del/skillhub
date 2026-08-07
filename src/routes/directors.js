const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const directorController = require('../controllers/directorController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { DIRECTOR_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...DIRECTOR_ROLES));

const validators = [body('name').trim().notEmpty().withMessage('Name is required')];

router.get('/', directorController.index);
router.post('/', validators, directorController.create);
router.put('/:id', validators, directorController.update);

module.exports = router;
