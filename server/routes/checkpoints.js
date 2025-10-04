const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const { CHECKPOINTS, ROOT } = require('../utils/paths');
const { zipPaths } = require('../utils/zip');
const r = Router();

r.post('/checkpoint', async (_req, res) => {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const out = path.join(CHECKPOINTS, `ChangoAI_checkpoint_${ts}.zip`);
    await zipPaths(out, [
      path.join(ROOT, 'client'),
      path.join(ROOT, 'server'),
      path.join(ROOT, 'data'),
      path.join(ROOT, 'logs'),
      path.join(ROOT, 'TASKS.md'),
      path.join(ROOT, 'EVOLUTION.md')
    ]);
    return res.json({ ok:true, checkpoint: path.basename(out) });
  } catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

r.get('/checkpoint/latest', (req, res) => {
  try {
    if (!fs.existsSync(CHECKPOINTS)) return res.status(404).json({ ok:false, error:'no checkpoints yet' });
    const files = fs.readdirSync(CHECKPOINTS).filter(f=>f.endsWith('.zip')).sort();
    if (!files.length) return res.status(404).json({ ok:false, error:'no checkpoints yet' });
    const latest = files[files.length-1];
    return res.download(path.join(CHECKPOINTS, latest), latest);
  } catch(e){ return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});
module.exports = r;