const express = require('express');
const router = express.Router();

const studentDocumentController = require('../controllers/studentDocumentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { DOCUMENT_VERIFY_ROLES, DOCUMENT_REPORT_ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(...DOCUMENT_VERIFY_ROLES));

// Reports are oversight tools (admin/director/master_admin), placed before
// "/batches/:batchId" so "reports" isn't swallowed by the id param route.
router.get('/reports/missing', requireRole(...DOCUMENT_REPORT_ROLES), studentDocumentController.missingReport);
router.get('/reports/missing/export', requireRole(...DOCUMENT_REPORT_ROLES), studentDocumentController.missingReportExport);
router.get('/reports/monitor', requireRole(...DOCUMENT_REPORT_ROLES), studentDocumentController.monitorReport);

router.get('/', studentDocumentController.batchList);
router.post('/batches/:batchId/assign-operator', requireRole(...DOCUMENT_REPORT_ROLES), studentDocumentController.assignOperator);
router.get('/batches/:batchId', studentDocumentController.showBatch);
router.post('/batches/:batchId', studentDocumentController.updateBatch);

module.exports = router;
