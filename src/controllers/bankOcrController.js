const fs = require('fs/promises');
const { scanBankDocument } = require('../utils/bankDocumentOcr');

// POST /utils/scan-bank-document — used from the Users (data_entry_operator/
// center_coordinator payroll section), Trainers, and Centers (landlord bank
// details) forms. Returns extracted fields as JSON for the browser to
// pre-fill into the form; nothing is saved server-side from this call, and
// the uploaded photo itself is deleted immediately after OCR runs — it's
// only ever needed for the few seconds it takes to read it.
async function scan(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded.' });
  }

  try {
    const result = await scanBankDocument(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Could not read this photo. Try a clearer, well-lit shot, or enter the details manually.' });
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }
}

module.exports = { scan };
