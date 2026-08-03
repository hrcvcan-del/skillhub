const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post(
  '/login',
  loginLimiter,
  redirectIfAuthenticated,
  body('email').isEmail(),
  body('password').notEmpty(),
  authController.login
);

router.post('/logout', authController.logout);

router.get('/forgot-password', redirectIfAuthenticated, authController.showForgotPassword);
router.post('/forgot-password', redirectIfAuthenticated, authController.forgotPassword);

router.get('/reset-password/:token', redirectIfAuthenticated, authController.showResetPassword);
router.post('/reset-password/:token', redirectIfAuthenticated, authController.resetPassword);

module.exports = router;
