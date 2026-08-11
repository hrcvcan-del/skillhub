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

// The inverse of requireRole: a deny-list rather than an allow-list, for
// routes that are otherwise open to any authenticated user but need one
// specific role kept out (e.g. center_manager, an add-only login that must
// never reach a list/show page even though those routes impose no other
// role restriction). master_admin is NOT special-cased here — a route that
// explicitly wants to exclude a role means it, though in practice
// blockRole is never used against master_admin.
function blockRole(...blockedRoles) {
  return (req, res, next) => {
    if (req.currentUser && blockedRoles.includes(req.currentUser.role)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

module.exports = { requireRole, blockRole };
