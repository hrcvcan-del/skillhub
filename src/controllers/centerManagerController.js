// The center_manager role is add-only for Center Coordinator, Data Entry
// Operator, Trainer, and Mobilizer — create one, then done, no list/view
// access to any of them (see src/utils/roles.js, src/middleware/roles.js's
// blockRole, and the requireRole/blockRole calls across
// routes/{users,trainers,batches,students}.js). Training Centers is the
// one exception — they can also browse/edit the list (see routes/centers.js's
// editRoles). This is their post-login landing page (see
// dashboardController.index) — a menu of the "Add X" actions plus the one
// "view/edit" door they do have.
function home(req, res) {
  res.render('centerManager/home', { title: 'Add New' });
}

module.exports = { home };
