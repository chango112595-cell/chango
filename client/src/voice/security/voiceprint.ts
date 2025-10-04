/**
 * Voiceprint Engine - Lightweight MFCC-based voice biometric system
 * Uses 13-MFCC mean vectors for voice signature extraction and cosine similarity matching
 */

import { debugBus } from '../../dev/debugBus';
import { FEATURES } from '../../config/featureFlags';
import { healthMonitor } from '../../dev/health/monitor';

export interface VoiceprintData {
  id: string;
  mfccVector: number[];
  enrollmentDate: number;
  sampleCount: number;
}

export interface EnrollmentResult {
  success: boolean;
  voiceprint?: VoiceprintData;
  error?: string;
}

export interface MatchResult {
  match: boolean;
  similarity: number;
  threshold: number;
}

/**
 * Extract MFCC features from audio buffer
 * Returns 13-dimensional MFCC mean vector
 */
function extractMFCCFeatures(audioBuffer: Float32Array, sampleRate: number = 16000): number[] {
  // Validate input
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Audio buffer is empty');
  }
  
  // Handle sample rate properly - don't assume 16kHz
  const validSampleRates = [8000, 11025, 16000, 22050, 32000, 44100, 48000];
  if (!validSampleRates.includes(sampleRate)) {
    if (FEATURES.DEBUG_BUS) {
      debugBus.warn('Voiceprint', 'Non-standard sample rate', { sampleRate, normalizing: true });
    }
    // Find nearest valid sample rate
    const nearest = validSampleRates.reduce((prev, curr) => 
      Math.abs(curr - sampleRate) < Math.abs(prev - sampleRate) ? curr : prev
    );
    sampleRate = nearest;
  }
  
  // Frame size and hop size for analysis
  const frameSize = Math.floor(0.025 * sampleRate); // 25ms frames
  const hopSize = Math.floor(0.010 * sampleRate); // 10ms hop
  const numCoeffs = 13; // Number of MFCC coefficients
  
  // Check if audio is too short for processing
  const minSamples = frameSize * 2; // At least 2 frames
  if (audioBuffer.length < minSamples) {
    throw new Error(`Audio too short for analysis: ${audioBuffer.length} samples, need at least ${minSamples} samples (${minSamples / sampleRate * 1000}ms)`);
  }
  
  // Pre-emphasis filter
  const preEmphasis = 0.97;
  const filtered = new Float32Array(audioBuffer.length);
  filtered[0] = audioBuffer[0];
  for (let i = 1; i < audioBuffer.length; i++) {
    filtered[i] = audioBuffer[i] - preEmphasis * audioBuffer[i - 1];
  }
  
  // Frame extraction with Hamming window
  const frames = [];
  const hammingWindow = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    hammingWindow[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (frameSize - 1));
  }
  
  for (let start = 0; start + frameSize <= filtered.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = filtered[start + i] * hammingWindow[i];
    }
    frames.push(frame);
  }
  
  // Guard against zero frames
  if (frames.length === 0) {
    throw new Error('No frames extracted from audio - buffer too short');
  }
  
  // Calculate MFCCs for each frame
  const mfccFrames = frames.map(frame => calculateFrameMFCC(frame, sampleRate, numCoeffs));
  
  // Guard against zero MFCC frames division
  if (mfccFrames.length === 0) {
    throw new Error('Failed to extract MFCC features from frames');
  }
  
  // Calculate mean MFCC vector across all frames
  const meanMFCC = new Array(numCoeffs).fill(0);
  for (const mfcc of mfccFrames) {
    for (let i = 0; i < numCoeffs; i++) {
      meanMFCC[i] += mfcc[i];
    }
  }
  
  // Safe division with guard
  for (let i = 0; i < numCoeffs; i++) {
    meanMFCC[i] /= mfccFrames.length;
  }
  
  return meanMFCC;
}

/**
 * Calculate MFCC for a single frame
 */
function calculateFrameMFCC(frame: Float32Array, sampleRate: number, numCoeffs: number): number[] {
  const fftSize = 512;
  const numFilters = 26;
  
  // FFT (simplified - using DFT for demonstration)
  const spectrum = new Float32Array(fftSize / 2 + 1);
  for (let k = 0; k <= fftSize / 2; k++) {
    let real = 0, imag = 0;
    for (let n = 0; n < frame.length; n++) {
      const angle = -2 * Math.PI * k * n / fftSize;
      real += frame[n] * Math.cos(angle);
      imag += frame[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(real * real + imag * imag);
  }
  
  // Mel filterbank
  const melFilters = createMelFilterbank(fftSize, sampleRate, numFilters);
  const melEnergies = new Float32Array(numFilters);
  
  for (let i = 0; i < numFilters; i++) {
    let energy = 0;
    for (let j = 0; j <= fftSize / 2; j++) {
      energy += spectrum[j] * melFilters[i][j];
    }
    melEnergies[i] = Math.log(Math.max(energy, 1e-10));
  }
  
  // DCT to get MFCCs
  const mfcc = new Float32Array(numCoeffs);
  for (let i = 0; i < numCoeffs; i++) {
    let sum = 0;
    for (let j = 0; j < numFilters; j++) {
      sum += melEnergies[j] * Math.cos(Math.PI * i * (j + 0.5) / numFilters);
    }
    mfcc[i] = sum * Math.sqrt(2 / numFilters);
  }
  
  return Array.from(mfcc);
}

/**
 * Create Mel filterbank
 */
function createMelFilterbank(fftSize: number, sampleRate: number, numFilters: number): Float32Array[] {
  const melMin = 0;
  const melMax = 2595 * Math.log10(1 + sampleRate / 2 / 700);
  const melPoints = new Float32Array(numFilters + 2);
  
  for (let i = 0; i < numFilters + 2; i++) {
    const mel = melMin + i * (melMax - melMin) / (numFilters + 1);
    melPoints[i] = 700 * (Math.pow(10, mel / 2595) - 1);
  }
  
  const filterbank = [];
  const binFreqs = new Float32Array(fftSize / 2 + 1);
  for (let i = 0; i <= fftSize / 2; i++) {
    binFreqs[i] = i * sampleRate / fftSize;
  }
  
  for (let i = 0; i < numFilters; i++) {
    const filter = new Float32Array(fftSize / 2 + 1);
    const leftFreq = melPoints[i];
    const centerFreq = melPoints[i + 1];
    const rightFreq = melPoints[i + 2];
    
    for (let j = 0; j <= fftSize / 2; j++) {
      const freq = binFreqs[j];
      if (freq < leftFreq) {
        filter[j] = 0;
      } else if (freq < centerFreq) {
        filter[j] = (freq - leftFreq) / (centerFreq - leftFreq);
      } else if (freq < rightFreq) {
        filter[j] = (rightFreq - freq) / (rightFreq - centerFreq);
      } else {
        filter[j] = 0;
      }
    }
    
    filterbank.push(filter);
  }
  
  return filterbank;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }
  
  return dotProduct / (mag1 * mag2);
}

/**
 * Voiceprint Engine class
 */
export class VoiceprintEngine {
  private enrollmentDuration = 7000; // 7 seconds for enrollment
  private defaultThreshold = 0.85; // Default similarity threshold
  
  /**
   * Enroll a new voiceprint from audio samples
   */
  async enroll(audioBuffer: Float32Array, sampleRate: number = 16000): Promise<EnrollmentResult> {
    try {
      // Emit enrollment start event
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Voiceprint', 'enrollment_start', { 
          sampleRate, 
          bufferSize: audioBuffer.length,
          duration: audioBuffer.length / sampleRate 
        });
      }
      
      // Report heartbeat
      healthMonitor.beat('voiceprint', { action: 'enrolling' });
      
      // Extract MFCC features
      const mfccVector = extractMFCCFeatures(audioBuffer, sampleRate);
      
      // Create voiceprint data
      const voiceprint: VoiceprintData = {
        id: `voiceprint_${Date.now()}`,
        mfccVector,
        enrollmentDate: Date.now(),
        sampleCount: audioBuffer.length
      };
      
      // Emit enrollment success event
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Voiceprint', 'enrollment_success', { 
          id: voiceprint.id,
          vectorDimensions: mfccVector.length,
          sampleCount: voiceprint.sampleCount
        });
      }
      
      // Report heartbeat
      healthMonitor.beat('voiceprint', { action: 'enrolled', id: voiceprint.id });
      
      return {
        success: true,
        voiceprint
      };
    } catch (error) {
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('Voiceprint', 'enrollment_failure', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown enrollment error'
      };
    }
  }
  
  /**
   * Verify audio against stored voiceprint
   */
  async verify(
    audioBuffer: Float32Array,
    storedVoiceprint: VoiceprintData,
    threshold: number = this.defaultThreshold,
    sampleRate: number = 16000
  ): Promise<MatchResult> {
    try {
      // Emit verification start event
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Voiceprint', 'verification_start', { 
          voiceprintId: storedVoiceprint.id,
          threshold,
          bufferSize: audioBuffer.length 
        });
      }
      
      // Report heartbeat
      healthMonitor.beat('voiceprint', { action: 'verifying' });
      
      // Extract features from input audio
      const inputFeatures = extractMFCCFeatures(audioBuffer, sampleRate);
      
      // Calculate similarity
      const similarity = cosineSimilarity(inputFeatures, storedVoiceprint.mfccVector);
      
      const match = similarity >= threshold;
      
      // Emit verification result event
      if (FEATURES.DEBUG_BUS) {
        if (match) {
          debugBus.info('Voiceprint', 'verification_success', { 
            voiceprintId: storedVoiceprint.id,
            similarity,
            threshold 
          });
        } else {
          debugBus.warn('Voiceprint', 'verification_failed', { 
            voiceprintId: storedVoiceprint.id,
            similarity,
            threshold,
            delta: threshold - similarity
          });
        }
      }
      
      // Report heartbeat with result
      healthMonitor.beat('voiceprint', { 
        action: 'verified', 
        match,
        similarity 
      });
      
      return {
        match,
        similarity,
        threshold
      };
    } catch (error) {
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('Voiceprint', 'verification_error', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      
      return {
        match: false,
        similarity: 0,
        threshold
      };
    }
  }
  
  /**
   * Update voiceprint with additional samples (adaptive learning)
   */
  async update(
    existingVoiceprint: VoiceprintData,
    newAudioBuffer: Float32Array,
    weight: number = 0.1,
    sampleRate: number = 16000
  ): Promise<VoiceprintData> {
    try {
      // Emit update start event
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Voiceprint', 'update_start', { 
          voiceprintId: existingVoiceprint.id,
          weight,
          newSamples: newAudioBuffer.length
        });
      }
      
      // Extract features from new audio
      const newFeatures = extractMFCCFeatures(newAudioBuffer, sampleRate);
      
      // Weighted average with existing voiceprint
      const updatedVector = existingVoiceprint.mfccVector.map((val, idx) => {
        return val * (1 - weight) + newFeatures[idx] * weight;
      });
      
      const updatedVoiceprint = {
        ...existingVoiceprint,
        mfccVector: updatedVector,
        sampleCount: existingVoiceprint.sampleCount + newAudioBuffer.length
      };
      
      // Emit update success event
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('Voiceprint', 'update_success', { 
          voiceprintId: existingVoiceprint.id,
          totalSamples: updatedVoiceprint.sampleCount,
          adaptationWeight: weight
        });
      }
      
      // Report heartbeat
      healthMonitor.beat('voiceprint', { action: 'updated' });
      
      return updatedVoiceprint;
    } catch (error) {
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('Voiceprint', 'update_failure', { 
          voiceprintId: existingVoiceprint.id,
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      
      // Return original voiceprint on error
      return existingVoiceprint;
    }
  }
  
  /**
   * Get enrollment audio duration requirement
   */
  getEnrollmentDuration(): number {
    return this.enrollmentDuration;
  }
  
  /**
   * Calculate similarity between two voiceprints
   */
  comparePrints(print1: VoiceprintData, print2: VoiceprintData): number {
    return cosineSimilarity(print1.mfccVector, print2.mfccVector);
  }
}

// Export singleton instance
export const voiceprintEngine = new VoiceprintEngine();