import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { PROFILES, ensureDirs } from './utils/paths';
import * as wavDecoder from 'wav-decoder';

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      // Ensure the profiles directory exists
      await ensureDirs();
      const tempDir = path.join(PROFILES, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${randomUUID()}_${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept any audio format, we'll convert with ffmpeg
    if (file.mimetype.startsWith('audio/') || 
        file.originalname.match(/\.(mp3|wav|ogg|m4a|flac|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Accent profile type
interface AccentProfile {
  neutral: number;
  brit_rp: number;
  southern_us: number;
  spanish_en: number;
  caribbean: number;
}

// Voice profile structure
interface VoiceProfileData {
  id: string;
  features: {
    duration: number;
    pauseRatio: number;
    f0: number;
    wpm: number;
    sibilance: number;
    rhoticity: number;
    rms: number;
    spectralCentroid: number;
  };
  mappedAccent: string;
  accentConfidences: AccentProfile;
  parameters: {
    rate: number;
    pitch: number;
    volume: number;
    emphasis: number;
  };
  createdAt: string;
  originalFilename?: string;
}

// Check if ffmpeg is available
function checkFfmpeg(): boolean {
  try {
    const result = spawnSync('ffmpeg', ['-version'], { 
      encoding: 'utf8',
      timeout: 3000
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

// Convert audio file to WAV using ffmpeg
async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Convert to mono WAV at 22050Hz sample rate
    const result = spawnSync('ffmpeg', [
      '-i', inputPath,
      '-acodec', 'pcm_s16le',
      '-ar', '22050',
      '-ac', '1',
      '-y',
      outputPath
    ], {
      encoding: 'utf8',
      timeout: 30000 // 30 seconds timeout
    });

    if (result.status !== 0) {
      reject(new Error(`FFmpeg conversion failed: ${result.stderr || result.error}`));
    } else {
      resolve();
    }
  });
}

// Analyze audio features from WAV file
async function analyzeAudio(wavPath: string): Promise<VoiceProfileData['features']> {
  try {
    // Read the WAV file
    const audioData = await fs.readFile(wavPath);
    const audioBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
    
    // Decode the WAV file
    const decoded = await wavDecoder.decode(audioBuffer);
    const samples = decoded.channelData[0]; // Get first channel (mono)
    const sampleRate = decoded.sampleRate;
    const duration = samples.length / sampleRate;

    // Calculate RMS (Root Mean Square) for volume/energy
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquares / samples.length);

    // Calculate pause ratio (simplified: ratio of low energy frames)
    const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
    const threshold = rms * 0.1; // 10% of average energy
    let silentFrames = 0;
    let totalFrames = 0;
    
    for (let i = 0; i < samples.length - frameSize; i += frameSize) {
      let frameEnergy = 0;
      for (let j = 0; j < frameSize; j++) {
        frameEnergy += samples[i + j] * samples[i + j];
      }
      frameEnergy = Math.sqrt(frameEnergy / frameSize);
      if (frameEnergy < threshold) {
        silentFrames++;
      }
      totalFrames++;
    }
    const pauseRatio = silentFrames / totalFrames;

    // Estimate fundamental frequency (simplified autocorrelation)
    const estimateF0 = (segment: Float32Array): number => {
      const minPeriod = Math.floor(sampleRate / 400); // Max 400Hz
      const maxPeriod = Math.floor(sampleRate / 50);  // Min 50Hz
      let maxCorr = 0;
      let bestPeriod = 0;

      for (let period = minPeriod; period < maxPeriod; period++) {
        let corr = 0;
        let count = 0;
        for (let i = 0; i < segment.length - period; i++) {
          corr += segment[i] * segment[i + period];
          count++;
        }
        corr = corr / count;
        if (corr > maxCorr) {
          maxCorr = corr;
          bestPeriod = period;
        }
      }
      return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
    };

    // Get middle segment for F0 estimation
    const midStart = Math.floor(samples.length * 0.4);
    const midEnd = Math.floor(samples.length * 0.6);
    const midSegment = samples.slice(midStart, midEnd);
    const f0 = estimateF0(midSegment);

    // Estimate words per minute (based on syllable rate approximation)
    // Assuming average speaking rate correlates with pause ratio
    const wpm = Math.round(150 * (1 - pauseRatio * 0.5)); // Base 150 wpm, adjusted by pauses

    // Calculate spectral features for sibilance and rhoticity
    // Simplified FFT-based analysis
    const fftSize = 2048;
    const fftSegment = samples.slice(0, Math.min(fftSize, samples.length));
    
    // Simple DFT for spectral analysis
    const spectrum = new Float32Array(fftSize / 2);
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < fftSegment.length; n++) {
        const angle = -2 * Math.PI * k * n / fftSize;
        real += fftSegment[n] * Math.cos(angle);
        imag += fftSegment[n] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }

    // Calculate spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const freq = i * sampleRate / fftSize;
      weightedSum += freq * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

    // Estimate sibilance (high frequency energy 4-8kHz)
    const sibilantStart = Math.floor(4000 * fftSize / sampleRate);
    const sibilantEnd = Math.floor(8000 * fftSize / sampleRate);
    let sibilantEnergy = 0;
    for (let i = sibilantStart; i < Math.min(sibilantEnd, spectrum.length); i++) {
      sibilantEnergy += spectrum[i];
    }
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    const sibilance = totalEnergy > 0 ? sibilantEnergy / totalEnergy : 0;

    // Estimate rhoticity (presence of R-colored vowels, around 1200-2400Hz)
    const rStart = Math.floor(1200 * fftSize / sampleRate);
    const rEnd = Math.floor(2400 * fftSize / sampleRate);
    let rEnergy = 0;
    for (let i = rStart; i < Math.min(rEnd, spectrum.length); i++) {
      rEnergy += spectrum[i];
    }
    const rhoticity = totalEnergy > 0 ? rEnergy / totalEnergy : 0;

    return {
      duration,
      pauseRatio,
      f0,
      wpm,
      sibilance,
      rhoticity,
      rms,
      spectralCentroid
    };
  } catch (error) {
    console.error('Audio analysis error:', error);
    // Return default values on error
    return {
      duration: 0,
      pauseRatio: 0.2,
      f0: 150,
      wpm: 150,
      sibilance: 0.1,
      rhoticity: 0.1,
      rms: 0.1,
      spectralCentroid: 1500
    };
  }
}

// Map audio features to accent profiles
function mapToAccentProfile(features: VoiceProfileData['features']): { 
  accent: string; 
  confidences: AccentProfile;
  parameters: VoiceProfileData['parameters'];
} {
  const confidences: AccentProfile = {
    neutral: 0,
    brit_rp: 0,
    southern_us: 0,
    spanish_en: 0,
    caribbean: 0
  };

  // Calculate confidence scores based on features
  // Neutral: balanced features
  confidences.neutral = 0.5;
  
  // British RP: lower pitch, moderate speed, lower rhoticity
  if (features.f0 < 140 && features.wpm > 140 && features.rhoticity < 0.15) {
    confidences.brit_rp = 0.7;
  } else if (features.f0 < 160 && features.rhoticity < 0.2) {
    confidences.brit_rp = 0.5;
  } else {
    confidences.brit_rp = 0.2;
  }

  // Southern US: slower, higher rhoticity, longer pauses
  if (features.wpm < 140 && features.rhoticity > 0.2 && features.pauseRatio > 0.25) {
    confidences.southern_us = 0.7;
  } else if (features.rhoticity > 0.18) {
    confidences.southern_us = 0.5;
  } else {
    confidences.southern_us = 0.2;
  }

  // Spanish English: higher pitch, specific sibilance pattern
  if (features.f0 > 160 && features.sibilance > 0.12) {
    confidences.spanish_en = 0.6;
  } else if (features.f0 > 150) {
    confidences.spanish_en = 0.4;
  } else {
    confidences.spanish_en = 0.2;
  }

  // Caribbean: rhythmic (varying pause ratio), moderate pitch
  if (features.pauseRatio > 0.15 && features.pauseRatio < 0.3 && features.f0 > 140 && features.f0 < 180) {
    confidences.caribbean = 0.6;
  } else if (features.f0 > 130 && features.f0 < 190) {
    confidences.caribbean = 0.4;
  } else {
    confidences.caribbean = 0.2;
  }

  // Normalize confidences
  const total = Object.values(confidences).reduce((sum, val) => sum + val, 0);
  if (total > 0) {
    for (const key in confidences) {
      confidences[key as keyof AccentProfile] = confidences[key as keyof AccentProfile] / total;
    }
  }

  // Find the accent with highest confidence
  let maxConfidence = 0;
  let mappedAccent = 'neutral';
  for (const [accent, confidence] of Object.entries(confidences)) {
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      mappedAccent = accent;
    }
  }

  // Calculate TTS parameters based on features
  const parameters = {
    rate: Math.max(0.5, Math.min(2.0, features.wpm / 150)),
    pitch: Math.max(0.5, Math.min(2.0, features.f0 / 150)),
    volume: Math.max(0.5, Math.min(1.5, features.rms * 10)),
    emphasis: Math.max(0.0, Math.min(1.0, features.spectralCentroid / 3000))
  };

  return { accent: mappedAccent, confidences, parameters };
}

// Create router
export const voiceProfileRouter = Router();

// POST /api/voice_profile/learn - Learn from uploaded audio
voiceProfileRouter.post('/learn', upload.single('audio'), async (req, res) => {
  let tempFilePath: string | null = null;
  let wavFilePath: string | null = null;
  
  try {
    // Check if ffmpeg is available
    if (!checkFfmpeg()) {
      return res.status(501).json({ 
        error: 'FFmpeg is not available on this system',
        details: 'Audio conversion requires FFmpeg to be installed'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    tempFilePath = req.file.path;
    const profileId = randomUUID();
    
    // Check if the file is already a WAV file
    const isWav = req.file.mimetype === 'audio/wav' || 
                  req.file.mimetype === 'audio/wave' || 
                  req.file.originalname.toLowerCase().endsWith('.wav');
    
    if (isWav) {
      // If it's already a WAV, just move it
      wavFilePath = path.join(PROFILES, 'temp', `${profileId}.wav`);
      await fs.copyFile(tempFilePath, wavFilePath);
    } else {
      // Convert to WAV
      wavFilePath = path.join(PROFILES, 'temp', `${profileId}.wav`);
      await convertToWav(tempFilePath, wavFilePath);
    }

    // Analyze audio features
    const features = await analyzeAudio(wavFilePath);

    // Map to accent profile
    const { accent, confidences, parameters } = mapToAccentProfile(features);

    // Create profile data
    const profile: VoiceProfileData = {
      id: profileId,
      features,
      mappedAccent: accent,
      accentConfidences: confidences,
      parameters,
      createdAt: new Date().toISOString(),
      originalFilename: req.file.originalname
    };

    // Save profile to JSON file
    const profilePath = path.join(PROFILES, `${profileId}.json`);
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));

    // Clean up temp files
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
    if (wavFilePath) await fs.unlink(wavFilePath).catch(() => {});

    res.json({ profile });
  } catch (error) {
    // Clean up temp files on error
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
    if (wavFilePath) await fs.unlink(wavFilePath).catch(() => {});
    
    console.error('Voice profile learning error:', error);
    res.status(500).json({ 
      error: 'Failed to process audio file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/voice_profile/list - List all voice profiles
voiceProfileRouter.get('/list', async (req, res) => {
  try {
    await ensureDirs();
    
    // Read all JSON files from profiles directory
    const files = await fs.readdir(PROFILES);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const profiles = [];
    for (const file of jsonFiles) {
      try {
        const profilePath = path.join(PROFILES, file);
        const data = await fs.readFile(profilePath, 'utf-8');
        const profile = JSON.parse(data) as VoiceProfileData;
        
        // Return summary for each profile
        profiles.push({
          id: profile.id,
          mappedAccent: profile.mappedAccent,
          createdAt: profile.createdAt,
          originalFilename: profile.originalFilename,
          duration: profile.features.duration,
          wpm: profile.features.wpm
        });
      } catch (err) {
        console.error(`Error reading profile ${file}:`, err);
        // Skip invalid files
      }
    }

    res.json({ profiles });
  } catch (error) {
    console.error('Error listing voice profiles:', error);
    res.status(500).json({ 
      error: 'Failed to list voice profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/voice_profile/get/:id - Get specific profile
voiceProfileRouter.get('/get/:id', async (req, res) => {
  try {
    const profileId = req.params.id;
    const profilePath = path.join(PROFILES, `${profileId}.json`);
    
    // Check if profile exists
    try {
      await fs.access(profilePath);
    } catch {
      return res.status(404).json({ error: 'Voice profile not found' });
    }

    // Read and return profile
    const data = await fs.readFile(profilePath, 'utf-8');
    const profile = JSON.parse(data) as VoiceProfileData;
    
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching voice profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch voice profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});