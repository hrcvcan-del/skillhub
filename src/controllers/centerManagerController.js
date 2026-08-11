// The center_manager role is add-only: create a Training Center, Center
// Coordinator, Data Entry Operator, Trainer, or Mobilizer, then done — no
// list/view access to any of them (see src/utils/roles.js,
// src/middleware/roles.js's blockRole, and the requireRole/blockRole calls
// across routes/{centers,users,trainers,batches,students}.js). This is
// their post-login landing page (see dashboardController.index) — a plain
// menu of the five "Add X" actions, since they have nothing else to look at.
function home(req, res) {
  res.render('centerManager/home', { title: 'Add New' });
}

module.exports = { home };
