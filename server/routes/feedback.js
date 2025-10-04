const { Router } = require('express');
const path = require('path');
const { DATA } = require('../utils/paths');
const { appendJSONL } = require('../utils/jsonl');
const r = Router();
const FEEDBACK = path.join(DATA, 'accents_log.jsonl');

r.post('/accent_feedback', (req, res) => {
  const payload = { ...(req.body||{}), ts_human: new Date().toISOString() };
  try { appendJSONL(FEEDBACK, payload); return res.json({ ok:true }); }
  catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});
module.exports = r;