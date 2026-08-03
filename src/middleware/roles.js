function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.redirect('/auth/login');
    }
    if (!allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

module.exports = { requireRole };
