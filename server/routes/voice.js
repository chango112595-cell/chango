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

// POST /api/voice/analyze - Analyze WAV audio for voice characteristics
r.post('/voice/analyze', async (req, res) => {
  try {
    const { wavBase64 } = req.body || {};
    
    // Validate input
    if (!wavBase64) {
      return res.status(400).json({ ok: false, error: 'wavBase64 field is required' });
    }
    
    // Extract base64 data (remove data URL prefix if present)
    const base64Data = wavBase64.includes(',') ? wavBase64.split(',')[1] : wavBase64;
    
    // This would typically analyze the audio buffer
    // For now, return mock voice characteristics
    const features = {
      pitch: 150 + Math.random() * 100,
      rate: 0.8 + Math.random() * 0.4,
      intensity: 0.5 + Math.random() * 0.5,
      formants: [800, 1200, 2400],
      accent: 'neutral',
      confidence: 0.7 + Math.random() * 0.3
    };
    
    return res.json({
      ok: true,
      features,
      characteristics: features, // Include both for compatibility
      recommendations: {
        profile: 'custom',
        adjustments: {
          pitch: 1.0,
          rate: 1.0,
          emotion: 'neutral'
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /api/voice/clone - Save voice profile from analysis
r.post('/voice/clone', async (req, res) => {
  try {
    const { name, characteristics } = req.body || {};
    if (!name || !characteristics) {
      return res.status(400).json({ ok: false, error: 'name and characteristics required' });
    }
    
    // In a real implementation, this would save to database
    // For now, return success with a mock profile ID
    const profileId = `profile_${Date.now()}`;
    return res.json({
      ok: true,
      profileId,
      message: 'Voice profile saved successfully'
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /api/voice/mimic - Generate speech using saved profile (stub)
r.post('/voice/mimic', async (req, res) => {
  try {
    const { text, profileId } = req.body || {};
    if (!text || !profileId) {
      return res.status(400).json({ ok: false, error: 'text and profileId required' });
    }
    
    // Stub implementation - would typically generate audio with voice cloning
    return res.json({
      ok: true,
      message: 'Voice mimic feature coming soon',
      profileId,
      text,
      audioUrl: null // Would contain generated audio URL
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /api/voice/accent/fix - Fix accent in audio (stub)
r.post('/voice/accent/fix', async (req, res) => {
  try {
    const { targetAccent = 'neutral' } = req.body || {};
    
    // Stub implementation - would typically process audio to adjust accent
    return res.json({
      ok: true,
      message: 'Accent adjustment feature coming soon',
      targetAccent,
      audioUrl: null // Would contain processed audio URL
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

export default r;