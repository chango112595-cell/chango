import { Router } from 'express';
import { planProsody, tokenize, ACCENTS, EMOTIONS } from '../voice/engine.js';
const r = Router();

// POST /voice/plan  { text, accent, intensity, emotion }
r.post('/voice/plan', (req, res) => {
  try {
    const { text = '', accent = 'neutral', intensity = 0.5, emotion = 'neutral' } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'text required' });
    }
    // Use the new phrase-based API directly with text
    const plan = planProsody(text, { accent, intensity: +intensity, emotion });
    return res.json({ ok: true, ...plan });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// GET /voice/accents - return available accents
r.get('/voice/accents', (_req, res) => {
  const accents = Object.entries(ACCENTS).map(([key, val]) => ({
    id: key,
    name: val.name
  }));
  return res.json({ ok: true, accents });
});

// GET /voice/emotions - return available emotions
r.get('/voice/emotions', (_req, res) => {
  const emotions = Object.keys(EMOTIONS);
  return res.json({ ok: true, emotions });
});

// keep a simple GET for quick tests
r.get('/voice/ping', (_req, res) => res.json({ ok: true, engine: 'CVE-1', route: 'client' }));

export default r;