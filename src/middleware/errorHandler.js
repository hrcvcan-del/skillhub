function notFoundHandler(req, res) {
  res.status(404).render('errors/404', { title: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'EBADCSRFTOKEN') {
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
