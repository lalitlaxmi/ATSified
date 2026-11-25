const { formidable } = require('formidable');
const fs = require('fs');
const engine = require('../lib/engine');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  try {
    const [fields, files] = await formidable({ maxFileSize: 4 * 1024 * 1024 }).parse(req);
    const file = (files.resume || [])[0];
    if (!file) return res.status(400).json({ error: 'Please upload a resume file.' });
    const buf = fs.readFileSync(file.filepath);
    fs.unlink(file.filepath, () => {});
    const text = await engine.extractText(buf, file.originalFilename || '');
    if (text.trim().length < 80)
      return res.status(422).json({ error: 'No readable text found. Scanned/image PDFs are not supported - upload a text-based PDF or DOCX.' });
    const v = (k) => (fields[k] || [])[0] || '';
    if (v('mode') === 'jd' && v('jd').trim().length < 40)
      return res.status(400).json({ error: 'Paste the full job description (at least a few lines).' });
    res.json(engine.analyze(text, { mode: v('mode'), role: v('role'), jd: v('jd'), hours: +v('hours') || 8 }));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Something went wrong.' });
  }
};
