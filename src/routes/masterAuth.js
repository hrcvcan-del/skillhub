const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const masterAuthController = require('../controllers/masterAuthController');
const { redirectIfAuthenticated } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

router.get('/login', redirectIfAuthenticated, masterAuthController.showLogin);
router.post(
  '/login',
  loginLimiter,
  redirectIfAuthenticated,
  body('email').isEmail(),
  body('password').notEmpty(),
  masterAuthController.login
);

module.exports = router;
