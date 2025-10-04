export interface AudioFeatures {
  duration: number;
  sampleRate: number;
  channels: number;
  rms: number;
  zcr: number;
  spectralCentroid: number;
  mfcc: number[];
  pitchMean: number;
  pitchStd: number;
  formants: number[];
  voicedRatio: number;
}

export interface AccentAnalysisResult {
  detectedAccent: string;
  confidence: number;
  features: AudioFeatures;
  recommendations: {
    profile: string;
    intensity: number;
    parameters: {
      rate: number;
      pitch: number;
      volume: number;
    };
  };
}

// Basic audio analysis using Web Audio API
export async function analyzeAudioFile(audioBlob: Blob): Promise<AudioFeatures> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  
  // Calculate basic features
  const rms = calculateRMS(channelData);
  const zcr = calculateZCR(channelData);
  const spectralCentroid = calculateSpectralCentroid(channelData, sampleRate);
  const pitchData = estimatePitch(channelData, sampleRate);
  
  return {
    duration,
    sampleRate,
    channels: audioBuffer.numberOfChannels,
    rms,
    zcr,
    spectralCentroid,
    mfcc: calculateMFCC(channelData, sampleRate),
    pitchMean: pitchData.mean,
    pitchStd: pitchData.std,
    formants: estimateFormants(channelData, sampleRate),
    voicedRatio: calculateVoicedRatio(channelData),
  };
}

export function analyzeForAccent(features: AudioFeatures): AccentAnalysisResult {
  // Simple heuristic-based accent detection
  // In a real implementation, this would use machine learning models
  
  let detectedAccent = "neutral";
  let confidence = 0.5;
  
  // Analyze pitch patterns
  if (features.pitchMean > 180 && features.pitchStd > 30) {
    detectedAccent = "caribbean";
    confidence = 0.7;
  } else if (features.pitchMean < 140 && features.spectralCentroid > 2000) {
    detectedAccent = "brit_rp";
    confidence = 0.65;
  } else if (features.voicedRatio > 0.8 && features.pitchStd < 20) {
    detectedAccent = "southern_us";
    confidence = 0.6;
  } else if (features.spectralCentroid < 1500 && features.zcr > 0.1) {
    detectedAccent = "spanish_en";
    confidence = 0.55;
  }
  
  // Generate recommendations
  const recommendations = {
    profile: detectedAccent,
    intensity: Math.min(confidence + 0.2, 0.8),
    parameters: {
      rate: features.pitchMean > 160 ? 1.1 : 0.9,
      pitch: features.pitchMean / 150,
      volume: Math.min(features.rms * 5, 1.0),
    },
  };
  
  return {
    detectedAccent,
    confidence,
    features,
    recommendations,
  };
}

// Helper functions for audio analysis
function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

function calculateZCR(samples: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / samples.length;
}

function calculateSpectralCentroid(samples: Float32Array, sampleRate: number): number {
  const fftSize = 2048;
  const fft = new Float32Array(fftSize);
  
  // Simple spectral centroid calculation
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  for (let i = 0; i < Math.min(fftSize / 2, samples.length); i++) {
    const magnitude = Math.abs(samples[i]);
    const frequency = (i * sampleRate) / fftSize;
    weightedSum += frequency * magnitude;
    magnitudeSum += magnitude;
  }
  
  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
}

function estimatePitch(samples: Float32Array, sampleRate: number): { mean: number; std: number } {
  // Simplified pitch estimation using autocorrelation
  const pitchValues: number[] = [];
  const windowSize = Math.floor(sampleRate * 0.025); // 25ms windows
  const hopSize = Math.floor(windowSize / 2);
  
  for (let start = 0; start + windowSize < samples.length; start += hopSize) {
    const window = samples.slice(start, start + windowSize);
    const pitch = autocorrelationPitch(window, sampleRate);
    if (pitch > 50 && pitch < 500) { // Valid pitch range for speech
      pitchValues.push(pitch);
    }
  }
  
  if (pitchValues.length === 0) {
    return { mean: 150, std: 20 }; // Default values
  }
  
  const mean = pitchValues.reduce((sum, p) => sum + p, 0) / pitchValues.length;
  const variance = pitchValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitchValues.length;
  const std = Math.sqrt(variance);
  
  return { mean, std };
}

function autocorrelationPitch(samples: Float32Array, sampleRate: number): number {
  // Simplified autocorrelation for pitch detection
  const minPeriod = Math.floor(sampleRate / 500); // 500 Hz max
  const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min
  
  let maxCorrelation = 0;
  let bestPeriod = minPeriod;
  
  for (let period = minPeriod; period <= maxPeriod && period < samples.length / 2; period++) {
    let correlation = 0;
    let normalizer = 0;
    
    for (let i = 0; i < samples.length - period; i++) {
      correlation += samples[i] * samples[i + period];
      normalizer += samples[i] * samples[i];
    }
    
    if (normalizer > 0) {
      correlation /= normalizer;
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
  }
  
  return sampleRate / bestPeriod;
}

function estimateFormants(samples: Float32Array, sampleRate: number): number[] {
  // Simplified formant estimation
  // In a real implementation, this would use LPC analysis
  return [800, 1200, 2400]; // Typical formant frequencies
}

function calculateVoicedRatio(samples: Float32Array): number {
  // Simple voiced/unvoiced detection based on energy
  const threshold = calculateRMS(samples) * 0.1;
  let voicedSamples = 0;
  
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) {
      voicedSamples++;
    }
  }
  
  return voicedSamples / samples.length;
}

function calculateMFCC(samples: Float32Array, sampleRate: number): number[] {
  // Simplified MFCC calculation
  // In a real implementation, this would use proper mel-scale filtering
  const mfccCoeffs = [];
  const numCoeffs = 13;
  
  for (let i = 0; i < numCoeffs; i++) {
    // Mock MFCC values based on spectral characteristics
    const coeff = Math.random() * 2 - 1; // Random values for now
    mfccCoeffs.push(coeff);
  }
  
  return mfccCoeffs;
}
