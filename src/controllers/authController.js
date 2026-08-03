const crypto = require('crypto');
const { User } = require('../models');
const env = require('../config/env');

function showLogin(req, res) {
  res.render('auth/login', { title: 'Login', errors: null, email: '' });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });

  if (!user || !user.is_active || !(await user.verifyPassword(password))) {
    return res.status(401).render('auth/login', {
      title: 'Login',
      errors: [{ field: 'email', message: 'Invalid email or password' }],
      email: email || '',
    });
  }

  req.session.regenerate(async (err) => {
    if (err) throw err;
    req.session.userId = user.id;
    user.last_login_at = new Date();
    await user.save();
    const dest = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(dest);
  });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
}

function showForgotPassword(req, res) {
  res.render('auth/forgot-password', { title: 'Forgot password', sent: false });
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ where: { email } });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = token;
    user.password_reset_expires_at = new Date(Date.now() + 1000 * 60 * 60);
    await user.save();

    const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password/${token}`;
    if (env.emailApiKey) {
      // Integration point: send via SendGrid/Resend using env.emailApiKey and env.emailFrom.
    } else {
      console.log(`[password reset] link for ${email}: ${resetLink}`);
    }
  }

  res.render('auth/forgot-password', { title: 'Forgot password', sent: true });
}

async function showResetPassword(req, res) {
  const { token } = req.params;
  const user = await User.findOne({ where: { password_reset_token: token } });
  if (!user || user.password_reset_expires_at < new Date()) {
    return res.render('auth/reset-password', { title: 'Reset password', invalid: true, token });
  }
  res.render('auth/reset-password', { title: 'Reset password', invalid: false, token, errors: null });
}

async function resetPassword(req, res) {
  const { token } = req.params;
  const { password, password_confirmation } = req.body;
  const user = await User.findOne({ where: { password_reset_token: token } });

  if (!user || user.password_reset_expires_at < new Date()) {
    return res.render('auth/reset-password', { title: 'Reset password', invalid: true, token });
  }

  if (!password || password.length < 8 || password !== password_confirmation) {
    return res.render('auth/reset-password', {
      title: 'Reset password',
      invalid: false,
      token,
      errors: [{ field: 'password', message: 'Passwords must match and be at least 8 characters' }],
    });
  }

  user.password_hash = password;
  user.password_reset_token = null;
  user.password_reset_expires_at = null;
  await user.save();

  req.setFlash('success', 'Password updated. Please log in.');
  res.redirect('/auth/login');
}

module.exports = {
  showLogin,
  login,
  logout,
  showForgotPassword,
  forgotPassword,
  showResetPassword,
  resetPassword,
};
