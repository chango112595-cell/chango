import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import fs_sync from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { PROFILES, ensureDirs } from './utils/paths';
import * as wavDecoder from 'wav-decoder';
import { storage, type LearnedVoiceProfile } from './storage';

// UUID v4 validation regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validate UUID v4 format
function isValidUuidV4(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        // Ensure the profiles directory exists - using synchronous version
        const tempDir = path.join(PROFILES, 'temp');
        fs_sync.mkdirSync(tempDir, { recursive: true });
        cb(null, tempDir);
      } catch (error) {
        cb(error as Error, '');
      }
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

// Use the VoiceProfileData type from storage as LearnedVoiceProfile
type VoiceProfileData = LearnedVoiceProfile;

// WAV file header validation result
interface WavValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    format?: string;
    audioFormat?: number;
    numChannels?: number;
    sampleRate?: number;
    bitsPerSample?: number;
  };
}

// Validate WAV file header and format
async function validateWavFile(filePath: string): Promise<WavValidationResult> {
  try {
    // Read the first 44 bytes (standard WAV header size)
    const fileHandle = await fs.open(filePath, 'r');
    const headerBuffer = Buffer.alloc(44);
    await fileHandle.read(headerBuffer, 0, 44, 0);
    await fileHandle.close();

    // Check RIFF header (bytes 0-3)
    const riffHeader = headerBuffer.toString('ascii', 0, 4);
    if (riffHeader !== 'RIFF') {
      return {
        isValid: false,
        error: `Invalid RIFF header. Expected 'RIFF', got '${riffHeader}'. File may not be a valid WAV file.`
      };
    }

    // Skip file size (bytes 4-7)

    // Check WAVE format (bytes 8-11)
    const waveFormat = headerBuffer.toString('ascii', 8, 12);
    if (waveFormat !== 'WAVE') {
      return {
        isValid: false,
        error: `Invalid WAVE format. Expected 'WAVE', got '${waveFormat}'. File is not a WAV audio file.`
      };
    }

    // Check fmt chunk (bytes 12-15)
    const fmtChunk = headerBuffer.toString('ascii', 12, 16);
    if (fmtChunk !== 'fmt ') {
      return {
        isValid: false,
        error: `Invalid format chunk. Expected 'fmt ', got '${fmtChunk}'. WAV file structure is corrupted.`
      };
    }

    // Skip subchunk1 size (bytes 16-19)

    // Audio format (bytes 20-21)
    const audioFormat = headerBuffer.readUInt16LE(20);
    // 1 = PCM (uncompressed), other values indicate compression
    if (audioFormat !== 1) {
      const formatName = audioFormat === 3 ? 'IEEE float' : 
                        audioFormat === 6 ? 'A-law' : 
                        audioFormat === 7 ? 'μ-law' : 
                        `format code ${audioFormat}`;
      return {
        isValid: false,
        error: `Audio is compressed or non-PCM format (${formatName}). Only uncompressed PCM WAV files are supported.`
      };
    }

    // Number of channels (bytes 22-23)
    const numChannels = headerBuffer.readUInt16LE(22);
    
    // Sample rate (bytes 24-27)
    const sampleRate = headerBuffer.readUInt32LE(24);
    
    // Skip byte rate (bytes 28-31) and block align (bytes 32-33)
    
    // Bits per sample (bytes 34-35)
    const bitsPerSample = headerBuffer.readUInt16LE(34);

    // Validate reasonable values
    if (numChannels < 1 || numChannels > 8) {
      return {
        isValid: false,
        error: `Invalid number of channels: ${numChannels}. Expected 1-8 channels.`
      };
    }

    if (sampleRate < 8000 || sampleRate > 192000) {
      return {
        isValid: false,
        error: `Unusual sample rate: ${sampleRate}Hz. Expected 8000-192000 Hz.`
      };
    }

    if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
      return {
        isValid: false,
        error: `Invalid bits per sample: ${bitsPerSample}. Expected 8, 16, 24, or 32 bits.`
      };
    }

    console.log(`WAV validation successful: ${numChannels} channel(s), ${sampleRate}Hz, ${bitsPerSample}-bit PCM`);

    return {
      isValid: true,
      details: {
        format: 'PCM',
        audioFormat,
        numChannels,
        sampleRate,
        bitsPerSample
      }
    };
  } catch (error) {
    console.error('Error validating WAV file:', error);
    return {
      isValid: false,
      error: `Failed to read WAV file header: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
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

// Audio analysis error class
class AudioAnalysisError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AudioAnalysisError';
  }
}

// Analyze audio features from WAV file
async function analyzeAudio(wavPath: string): Promise<VoiceProfileData['features']> {
  // First validate the WAV file structure
  const validation = await validateWavFile(wavPath);
  if (!validation.isValid) {
    throw new AudioAnalysisError(
      validation.error || 'Invalid WAV file format',
      'INVALID_WAV_FORMAT'
    );
  }

  try {
    // Read the WAV file
    const audioData = await fs.readFile(wavPath);
    const audioBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
    
    // Decode the WAV file
    let decoded;
    try {
      decoded = await wavDecoder.decode(audioBuffer);
    } catch (decodeError) {
      console.error('WAV decoder error:', decodeError);
      throw new AudioAnalysisError(
        `Failed to decode WAV file: ${decodeError instanceof Error ? decodeError.message : 'Unknown decode error'}`,
        'DECODE_ERROR'
      );
    }

    if (!decoded || !decoded.channelData || decoded.channelData.length === 0) {
      throw new AudioAnalysisError(
        'Decoded audio has no channel data',
        'NO_CHANNEL_DATA'
      );
    }
    const samples = decoded.channelData[0]; // Get first channel (mono)
    if (!samples || samples.length === 0) {
      throw new AudioAnalysisError(
        'Audio file has no samples or is empty',
        'EMPTY_AUDIO'
      );
    }

    const sampleRate = decoded.sampleRate;
    if (!sampleRate || sampleRate < 8000 || sampleRate > 192000) {
      throw new AudioAnalysisError(
        `Invalid sample rate: ${sampleRate}Hz. Expected 8000-192000 Hz.`,
        'INVALID_SAMPLE_RATE'
      );
    }

    const duration = samples.length / sampleRate;
    if (duration < 0.1) {
      throw new AudioAnalysisError(
        `Audio too short: ${duration.toFixed(2)} seconds. Minimum 0.1 seconds required.`,
        'AUDIO_TOO_SHORT'
      );
    }

    if (duration > 300) {
      throw new AudioAnalysisError(
        `Audio too long: ${duration.toFixed(2)} seconds. Maximum 5 minutes allowed.`,
        'AUDIO_TOO_LONG'
      );
    }

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
    // Re-throw AudioAnalysisError to be handled by the caller
    if (error instanceof AudioAnalysisError) {
      throw error;
    }
    
    // For unexpected errors, wrap them in AudioAnalysisError
    console.error('Unexpected audio analysis error:', error);
    throw new AudioAnalysisError(
      `Unexpected error during audio analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ANALYSIS_ERROR'
    );
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

// POST /api/voice-profiles - Learn from uploaded audio (matches frontend expectation)
voiceProfileRouter.post('/', upload.single('audio'), async (req, res) => {
  let tempFilePath: string | null = null;
  let wavFilePath: string | null = null;
  
  try {
    // Ensure directories exist at runtime
    await ensureDirs();
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

    // Validate the WAV file after conversion
    const validation = await validateWavFile(wavFilePath);
    if (!validation.isValid) {
      console.error('WAV validation failed:', validation.error);
      return res.status(400).json({
        error: 'Invalid audio file format',
        details: validation.error
      });
    }

    // Analyze audio features
    let features: VoiceProfileData['features'];
    try {
      features = await analyzeAudio(wavFilePath);
    } catch (analysisError) {
      if (analysisError instanceof AudioAnalysisError) {
        console.error(`Audio analysis failed [${analysisError.code}]:`, analysisError.message);
        
        // Return specific error codes for different failure types
        const statusCode = 
          analysisError.code === 'INVALID_WAV_FORMAT' ? 400 :
          analysisError.code === 'EMPTY_AUDIO' ? 400 :
          analysisError.code === 'AUDIO_TOO_SHORT' ? 400 :
          analysisError.code === 'AUDIO_TOO_LONG' ? 400 :
          analysisError.code === 'INVALID_SAMPLE_RATE' ? 400 :
          analysisError.code === 'NO_CHANNEL_DATA' ? 400 :
          analysisError.code === 'DECODE_ERROR' ? 422 : // Unprocessable entity
          500; // Generic error
        
        return res.status(statusCode).json({
          error: 'Audio analysis failed',
          details: analysisError.message,
          code: analysisError.code
        });
      }
      
      // Unexpected error
      console.error('Unexpected analysis error:', analysisError);
      return res.status(500).json({
        error: 'Failed to analyze audio',
        details: analysisError instanceof Error ? analysisError.message : 'Unknown error'
      });
    }

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

    // Save profile using storage interface
    const savedProfile = await storage.learnVoiceProfile(profile);

    res.json({ profile: savedProfile });
  } catch (error) {
    console.error('Voice profile learning error:', error);
    res.status(500).json({ 
      error: 'Failed to process audio file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Always clean up temp files, even if an error occurred
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', tempFilePath, cleanupError);
      }
    }
    if (wavFilePath) {
      try {
        await fs.unlink(wavFilePath);
      } catch (cleanupError) {
        console.error('Failed to clean up WAV file:', wavFilePath, cleanupError);
      }
    }
  }
});

// GET /api/voice-profiles - List all voice profiles
voiceProfileRouter.get('/', async (req, res) => {
  try {
    // Get all profiles using storage interface
    const profiles = await storage.getAllLearnedVoiceProfiles();
    
    // Return summary for each profile
    const profileSummaries = profiles.map(profile => ({
      id: profile.id,
      mappedAccent: profile.mappedAccent,
      createdAt: profile.createdAt,
      originalFilename: profile.originalFilename,
      duration: profile.features.duration,
      wpm: profile.features.wpm
    }));

    res.json({ profiles: profileSummaries });
  } catch (error) {
    console.error('Error listing voice profiles:', error);
    res.status(500).json({ 
      error: 'Failed to list voice profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/voice-profiles/:id - Get specific profile
voiceProfileRouter.get('/:id', async (req, res) => {
  try {
    const profileId = req.params.id;
    
    // Validate UUID v4 format to prevent path traversal
    if (!isValidUuidV4(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID format. Must be a valid UUID v4.' });
    }
    
    // Get profile using storage interface
    const profile = await storage.getLearnedVoiceProfile(profileId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Voice profile not found' });
    }
    
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching voice profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch voice profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});