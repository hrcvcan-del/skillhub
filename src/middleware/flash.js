function flash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  req.setFlash = (type, message) => {
    req.session.flash = { type, message };
  };
  next();
}

module.exports = flash;
