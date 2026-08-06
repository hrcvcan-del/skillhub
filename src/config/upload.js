const path = require('path');
const fs = require('fs');
const multer = require('multer');
const env = require('./env');

const uploadDir = path.resolve(env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, or PDF receipts are allowed'));
    }
    cb(null, true);
  },
});

const statementExtensions = ['.csv', '.xls', '.xlsx'];

// Bank statement uploads are validated by extension rather than mimetype:
// browsers/OSes report CSV/Excel mimetypes very inconsistently (text/csv,
// text/plain, application/vnd.ms-excel, application/octet-stream, ...),
// so the extension is the more reliable signal here.
const statementUpload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!statementExtensions.includes(ext)) {
      return cb(new Error('Only CSV, XLS, or XLSX bank statement files are allowed'));
    }
    cb(null, true);
  },
});

upload.statementUpload = statementUpload;

module.exports = upload;
