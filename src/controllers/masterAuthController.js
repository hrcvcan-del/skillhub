// Dedicated login for the master_admin role only, kept separate from the
// regular /auth/login form deliberately: master_admin accounts are
// rejected there (see authController.login) regardless of how correct
// the password is, so even a leaked password is useless without also
// knowing this URL.
const { User } = require('../models');

function showLogin(req, res) {
  res.render('auth/master-login', { title: 'Master Admin Access', errors: null, email: '' });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  // Same timing-normalization as the regular login: always run the
  // password check when a row exists, even for non-master_admin users
  // (who are rejected regardless), so a correct password on the wrong
  // role doesn't resolve faster than a wrong one.
  const passwordOk = user ? await user.verifyPassword(password) : false;

  if (!user || !user.is_active || user.role !== 'master_admin' || !passwordOk) {
    return res.status(401).render('auth/master-login', {
      title: 'Master Admin Access',
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

module.exports = { showLogin, login };
