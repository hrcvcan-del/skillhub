const { User } = require('../models');

async function loadCurrentUser(req, res, next) {
  if (req.session.userId) {
    const user = await User.findByPk(req.session.userId);
    if (user && user.is_active) {
      req.currentUser = user;
    } else {
      req.session.userId = null;
    }
  }
  res.locals.currentUser = req.currentUser || null;
  next();
}

module.exports = loadCurrentUser;
