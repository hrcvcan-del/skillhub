const express = require('express');
const router = express.Router();

const bankOcrController = require('../controllers/bankOcrController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../config/upload');

// No extra role gate beyond being logged in — this endpoint doesn't read
// or write anything in the database, it only OCRs a photo the caller just
// uploaded and hands the extracted text back. It's only ever reachable in
// practice from the three forms that already have their own role checks
// (Users, Trainers, Centers).
router.use(requireAuth);

router.post('/scan-bank-document', upload.bankDocumentUpload.single('photo'), bankOcrController.scan);

module.exports = router;
