const DEFAULT_PAGE_SIZE = 10;

function buildPagination(req, totalItems, pageSize = DEFAULT_PAGE_SIZE) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    offset: (page - 1) * pageSize,
    queryString(targetPage) {
      const params = new URLSearchParams(req.query);
      params.set('page', targetPage);
      return params.toString();
    },
  };
}

function parseSort(req, allowedFields, defaultField = 'id') {
  const field = allowedFields.includes(req.query.sort) ? req.query.sort : defaultField;
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
  return [[field, dir]];
}

module.exports = { buildPagination, parseSort, DEFAULT_PAGE_SIZE };
