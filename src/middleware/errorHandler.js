function notFoundHandler(req, res) {
  res.status(404).render('errors/404', { title: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'EBADCSRFTOKEN') {
    // Every page's header (the navbar's own Logout form) embeds
    // res.locals.csrfToken — normally set by the small middleware that
    // runs right after csurf() succeeds (see app.js). A CSRF failure is
    // exactly the one path that never reaches that middleware, so without
    // this, rendering this very page throws "csrfToken is not defined"
    // while EJS evaluates the header partial — an uncaught exception with
    // no further error middleware to catch it, which crashes the whole
    // Node process (seen live as a 502 while the container restarts,
    // instead of the intended "Session expired" message).
    try {
      res.locals.csrfToken = req.csrfToken();
    } catch (e) {
      res.locals.csrfToken = '';
    }
    return res.status(403).render('errors/403', {
      title: 'Session expired',
      message: 'Your form session expired or was tampered with. Please go back and try again.',
    });
  }

  const status = err.status || 500;
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(status).json({ error: { message: err.message || 'Internal server error', code: status } });
  }
  res.status(status).render('errors/500', {
    title: 'Something went wrong',
    message: err.message,
  });
}

module.exports = { notFoundHandler, errorHandler };
