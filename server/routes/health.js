const { Router } = require('express');
const r = Router();
r.get('/', (_req, res) => res.json({ ok:true, service:'ChangoAI v1.2 unified' }));
module.exports = r;