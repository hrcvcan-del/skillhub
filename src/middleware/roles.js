function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.redirect('/auth/login');
    }

    const { role } = req.currentUser;
    // 'master_admin' is the top of the hierarchy and always passes,
    // regardless of what the route asked for — it never needs to be listed
    // alongside every other role.
    // 'director' is the organizational super-admin and is always granted
    // whatever 'admin' is granted, so routes don't need to list both.
    const permitted =
      role === 'master_admin' || allowedRoles.includes(role) || (role === 'director' && allowedRoles.includes('admin'));

    if (!permitted) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

module.exports = { requireRole };
