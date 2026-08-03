const { validationResult } = require('express-validator');

function getErrors(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  return result.array().map((e) => ({ field: e.path, message: e.msg }));
}

module.exports = { getErrors };
