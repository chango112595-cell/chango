import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Ensure data/voice directory exists
const PROFILES_DIR = path.join(process.cwd(), 'data', 'voice');
await fs.mkdir(PROFILES_DIR, { recursive: true }).catch(() => {});

// Naive audio feature extractor (no heavy DSP libs)
function extractNaiveFeatures(audioBase64) {
  // Convert base64 to buffer for basic analysis
  const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Naive feature extraction based on buffer statistics
  const bufferLength = buffer.length;
  let sum = 0;
  let variance = 0;
  let maxAmplitude = 0;
  let zeroCrossings = 0;
  let previousSample = 0;
  
  // Analyze audio buffer (assuming 16-bit PCM)
  for (let i = 0; i < bufferLength - 1; i += 2) {
    const sample = buffer.readInt16LE(i);
    sum += Math.abs(sample);
    
    if (Math.abs(sample) > maxAmplitude) {
      maxAmplitude = Math.abs(sample);
    }
    
    // Count zero crossings for pitch hint
    if (previousSample > 0 && sample <= 0 || previousSample <= 0 && sample > 0) {
      zeroCrossings++;
    }
    previousSample = sample;
  }
  
  const sampleCount = bufferLength / 2;
  const avgAmplitude = sum / sampleCount;
  
  // Calculate variance for energy measurement
  for (let i = 0; i < bufferLength - 1; i += 2) {
    const sample = buffer.readInt16LE(i);
    variance += Math.pow(Math.abs(sample) - avgAmplitude, 2);
  }
  variance /= sampleCount;
  
  // Naive pitch estimation from zero crossings (very rough)
  // Assuming 44.1kHz sample rate for rough estimation
  const estimatedDuration = sampleCount / 44100;
  const pitchHint = Math.min(400, Math.max(80, (zeroCrossings / estimatedDuration) / 2));
  
  // Energy level (0-1 scale)
  const energy = Math.min(1, maxAmplitude / 32768);
  
  // Speaking rate hint based on energy variations
  const speakingRateHint = Math.min(2, Math.max(0.5, 1 + (variance / 1000000000)));
  
  return {
    pitchHint,
    speakingRate: speakingRateHint,
    energy,
    duration: estimatedDuration,
    zeroCrossings,
    avgAmplitude: avgAmplitude / 32768,
    variance,
    bufferSize: bufferLength,
    timestamp: new Date().toISOString()
  };
}

// Gender and accent style presets
const STYLE_PRESETS = {
  gender: {
    neutral: { pitchMod: 1.0, rateMod: 1.0, name: 'Neutral' },
    female: { pitchMod: 1.15, rateMod: 1.05, name: 'Female' },
    male: { pitchMod: 0.85, rateMod: 0.95, name: 'Male' }
  },
  accent: {
    neutral: { pitchMod: 1.0, rateMod: 1.0, intonation: 'standard' },
    british: { pitchMod: 1.02, rateMod: 0.98, intonation: 'rp' },
    southern_us: { pitchMod: 0.98, rateMod: 0.92, intonation: 'drawl' },
    spanish_en: { pitchMod: 1.05, rateMod: 1.03, intonation: 'rhythmic' },
    caribbean: { pitchMod: 1.08, rateMod: 0.95, intonation: 'melodic' }
  }
};

// POST /voice/intel/analyze - Analyze voice from base64 audio
router.post('/voice/intel/analyze', async (req, res) => {
  try {
    const { audioBase64, note = '' } = req.body || {};
    
    if (!audioBase64) {
      return res.status(400).json({ 
        ok: false, 
        error: 'audioBase64 is required' 
      });
    }
    
    // Extract naive features
    const features = extractNaiveFeatures(audioBase64);
    
    // Add note if provided
    if (note) {
      features.note = note;
    }
    
    // Guess gender based on pitch (very rough heuristic)
    let suggestedGender = 'neutral';
    if (features.pitchHint < 140) {
      suggestedGender = 'male';
    } else if (features.pitchHint > 180) {
      suggestedGender = 'female';
    }
    
    return res.json({
      ok: true,
      features,
      suggestions: {
        gender: suggestedGender,
        accent: 'neutral',
        confidence: 0.3 + Math.random() * 0.4 // Naive confidence
      }
    });
    
  } catch (error) {
    console.error('[Intel] Analysis error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: String(error.message || error) 
    });
  }
});

// POST /voice/intel/profile/save - Save voice profile
router.post('/voice/intel/profile/save', async (req, res) => {
  try {
    const { name, features, gender = 'neutral', accent = 'neutral' } = req.body || {};
    
    if (!name || !features) {
      return res.status(400).json({ 
        ok: false, 
        error: 'name and features are required' 
      });
    }
    
    // Generate profile ID
    const profileId = `profile_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Create profile object
    const profile = {
      id: profileId,
      name,
      features,
      gender,
      accent,
      createdAt: new Date().toISOString(),
      version: '1.0'
    };
    
    // Save to JSON file
    const profilePath = path.join(PROFILES_DIR, `${profileId}.json`);
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    
    return res.json({
      ok: true,
      profileId,
      message: 'Voice profile saved successfully',
      profile
    });
    
  } catch (error) {
    console.error('[Intel] Save profile error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: String(error.message || error) 
    });
  }
});

// GET /voice/intel/profile/list - List saved profiles
router.get('/voice/intel/profile/list', async (req, res) => {
  try {
    // Read all JSON files from profiles directory
    const files = await fs.readdir(PROFILES_DIR);
    const profiles = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const profilePath = path.join(PROFILES_DIR, file);
          const content = await fs.readFile(profilePath, 'utf8');
          const profile = JSON.parse(content);
          
          // Return summary info
          profiles.push({
            id: profile.id,
            name: profile.name,
            gender: profile.gender,
            accent: profile.accent,
            createdAt: profile.createdAt
          });
        } catch (err) {
          console.error(`[Intel] Error reading profile ${file}:`, err);
        }
      }
    }
    
    // Sort by creation date (newest first)
    profiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return res.json({
      ok: true,
      profiles,
      count: profiles.length
    });
    
  } catch (error) {
    console.error('[Intel] List profiles error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: String(error.message || error) 
    });
  }
});

// GET /voice/intel/profile/get/:id - Get specific profile
router.get('/voice/intel/profile/get/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Profile ID is required' 
      });
    }
    
    // Read profile file
    const profilePath = path.join(PROFILES_DIR, `${id}.json`);
    
    try {
      const content = await fs.readFile(profilePath, 'utf8');
      const profile = JSON.parse(content);
      
      return res.json({
        ok: true,
        profile
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ 
          ok: false, 
          error: 'Profile not found' 
        });
      }
      throw err;
    }
    
  } catch (error) {
    console.error('[Intel] Get profile error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: String(error.message || error) 
    });
  }
});

// POST /voice/intel/style - Apply accent/gender style presets
router.post('/voice/intel/style', async (req, res) => {
  try {
    const { 
      accent = 'neutral', 
      gender = 'neutral',
      baseFeatures = {}
    } = req.body || {};
    
    // Get style presets
    const genderStyle = STYLE_PRESETS.gender[gender] || STYLE_PRESETS.gender.neutral;
    const accentStyle = STYLE_PRESETS.accent[accent] || STYLE_PRESETS.accent.neutral;
    
    // Apply style modifications to base features
    const modifiedFeatures = {
      ...baseFeatures,
      pitchHint: (baseFeatures.pitchHint || 150) * genderStyle.pitchMod * accentStyle.pitchMod,
      speakingRate: (baseFeatures.speakingRate || 1.0) * genderStyle.rateMod * accentStyle.rateMod,
      intonation: accentStyle.intonation,
      gender,
      accent
    };
    
    // Calculate prosody adjustments for CVE
    const prosodyAdjustments = {
      pitch: genderStyle.pitchMod * accentStyle.pitchMod,
      rate: genderStyle.rateMod * accentStyle.rateMod,
      volume: 1.0,
      emotion: 'neutral'
    };
    
    return res.json({
      ok: true,
      style: {
        gender: genderStyle.name,
        accent,
        intonation: accentStyle.intonation
      },
      features: modifiedFeatures,
      prosodyAdjustments,
      message: `Applied ${genderStyle.name} gender and ${accent} accent styles`
    });
    
  } catch (error) {
    console.error('[Intel] Apply style error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: String(error.message || error) 
    });
  }
});

// DELETE /voice/intel/profile/delete/:id - Delete a profile
router.delete('/voice/intel/profile/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Profile ID is required' 
      });
    }
    
    // Delete profile file
    const profilePath = path.join(PROFILES_DIR, `${id}.json`);
    
    try {
      await fs.unlink(profilePath);
      
      return res.json({
        ok: true,
        message: 'Profile deleted successfully'
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ 
          ok: false, 
          error: 'Profile not found' 
        });
      }
      throw err;
    }
    
  } catch (error) {
    console.error('[Intel] Delete profile error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: String(error.message || error) 
    });
  }
});

export default router;