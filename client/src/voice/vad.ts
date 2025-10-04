/**
 * Voice Activity Detection (VAD) System
 * Implements energy + spectral flux detection with hysteresis
 */

import { voiceBus } from './voiceBus';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';

export interface VADConfig {
  energyThreshold: number;
  spectralFluxThreshold: number;
  silenceTimeout: number;
  speechMinDuration: number;
  hysteresisFrames: number;
  sampleRate: number;
  frameSize: number;
  hopSize: number;
}

export interface VADState {
  isSpeaking: boolean;
  energy: number;
  spectralFlux: number;
  silenceDuration: number;
  speechDuration: number;
}

export type VADEventType = 'speech_start' | 'speech_end' | 'energy_update';

export interface VADEvent {
  type: VADEventType;
  state: VADState;
  timestamp: number;
}

/**
 * Voice Activity Detection class
 */
export class VoiceActivityDetector {
  private config: VADConfig;
  private state: VADState;
  private listeners: Map<VADEventType, Set<(event: VADEvent) => void>>;
  private previousSpectrum: Float32Array | null = null;
  private hysteresisCounter: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private isMonitoring: boolean = false;
  
  constructor(config?: Partial<VADConfig>) {
    this.config = {
      energyThreshold: -50, // dB
      spectralFluxThreshold: 0.1,
      silenceTimeout: 1000, // 1 second
      speechMinDuration: 200, // 200ms minimum speech
      hysteresisFrames: 5, // 5 frames for state change
      sampleRate: 16000,
      frameSize: 512,
      hopSize: 256,
      ...config
    };
    
    this.state = {
      isSpeaking: false,
      energy: -100,
      spectralFlux: 0,
      silenceDuration: 0,
      speechDuration: 0
    };
    
    this.listeners = new Map();
  }
  
  /**
   * Initialize VAD with audio context
   */
  async initialize(stream?: MediaStream): Promise<void> {
    try {
      // Create audio context if not exists
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
      }
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.frameSize * 2;
      this.analyser.smoothingTimeConstant = 0.2;
      
      // Connect to stream if provided
      if (stream) {
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
      }
      
      console.log('[VAD] Initialized with config:', this.config);
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VAD', 'Initialized', this.config);
      }
    } catch (error) {
      console.error('[VAD] Initialization error:', error);
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('VAD', 'Initialization failed', { error });
      }
      throw error;
    }
  }
  
  /**
   * Start monitoring for voice activity
   */
  start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.previousSpectrum = null;
    this.hysteresisCounter = 0;
    
    console.log('[VAD] Starting voice activity detection');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'Started monitoring');
    }
    
    this.monitor();
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    this.isMonitoring = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    console.log('[VAD] Stopped voice activity detection');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'Stopped monitoring');
    }
  }
  
  /**
   * Main monitoring loop
   */
  private monitor(): void {
    if (!this.isMonitoring || !this.analyser) {
      return;
    }
    
    // Get frequency data
    const bufferLength = this.analyser.frequencyBinCount;
    const frequencyData = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(frequencyData);
    
    // Calculate energy (RMS in dB)
    const energy = this.calculateEnergy(frequencyData);
    
    // Calculate spectral flux
    const spectralFlux = this.calculateSpectralFlux(frequencyData);
    
    // Update state
    const previousState = this.state.isSpeaking;
    this.updateState(energy, spectralFlux);
    
    // Emit events if state changed
    if (previousState !== this.state.isSpeaking) {
      const eventType = this.state.isSpeaking ? 'speech_start' : 'speech_end';
      this.emitEvent(eventType);
      
      // Emit detailed debug event with metrics
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VAD', eventType, {
          energy: energy.toFixed(2),
          flux: spectralFlux.toFixed(4),
          threshold: {
            energy: this.config.energyThreshold,
            flux: this.config.spectralFluxThreshold
          },
          duration: this.state.isSpeaking ? 0 : this.state.speechDuration
        });
      }
      
      // Emit to voice bus for integration
      if (this.state.isSpeaking) {
        voiceBus.emit({ type: 'stateChange', speaking: true });
      } else {
        voiceBus.emit({ type: 'stateChange', speaking: false });
      }
    }
    
    // Emit energy update with detailed metrics
    this.emitEvent('energy_update');
    
    // Continue monitoring
    this.animationFrameId = requestAnimationFrame(() => this.monitor());
  }
  
  /**
   * Calculate energy from frequency data
   */
  private calculateEnergy(frequencyData: Float32Array): number {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > -100) { // Ignore very low values
        sum += frequencyData[i];
        count++;
      }
    }
    
    return count > 0 ? sum / count : -100;
  }
  
  /**
   * Calculate spectral flux (change in spectrum)
   */
  private calculateSpectralFlux(frequencyData: Float32Array): number {
    if (!this.previousSpectrum) {
      this.previousSpectrum = new Float32Array(frequencyData);
      return 0;
    }
    
    let flux = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      const diff = frequencyData[i] - this.previousSpectrum[i];
      if (diff > 0) { // Only positive differences (onset detection)
        flux += diff;
      }
    }
    
    // Update previous spectrum
    this.previousSpectrum.set(frequencyData);
    
    // Normalize flux
    return flux / frequencyData.length;
  }
  
  /**
   * Update VAD state with hysteresis
   */
  private updateState(energy: number, spectralFlux: number): void {
    this.state.energy = energy;
    this.state.spectralFlux = spectralFlux;
    
    // Determine if voice is detected
    const voiceDetected = 
      energy > this.config.energyThreshold &&
      spectralFlux > this.config.spectralFluxThreshold;
    
    // Apply hysteresis to prevent rapid state changes
    if (voiceDetected !== this.state.isSpeaking) {
      this.hysteresisCounter++;
      
      if (this.hysteresisCounter >= this.config.hysteresisFrames) {
        // State change confirmed
        this.state.isSpeaking = voiceDetected;
        this.hysteresisCounter = 0;
        
        // Reset duration counters
        if (voiceDetected) {
          this.state.speechDuration = 0;
          this.state.silenceDuration = 0;
        }
      }
    } else {
      // Reset hysteresis counter if state is stable
      this.hysteresisCounter = 0;
      
      // Update duration counters
      const frameDuration = 1000 / 60; // Assuming 60 FPS
      if (this.state.isSpeaking) {
        this.state.speechDuration += frameDuration;
      } else {
        this.state.silenceDuration += frameDuration;
      }
    }
  }
  
  /**
   * Register event listener
   */
  on(eventType: VADEventType, listener: (event: VADEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }
  
  /**
   * Emit event to listeners
   */
  private emitEvent(type: VADEventType): void {
    const event: VADEvent = {
      type,
      state: { ...this.state },
      timestamp: Date.now()
    };
    
    // Emit debug event for energy updates with metrics
    if (type === 'energy_update' && FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'energy_update', {
        energy: this.state.energy.toFixed(2),
        flux: this.state.spectralFlux.toFixed(4),
        speaking: this.state.isSpeaking
      });
    }
    
    const eventListeners = this.listeners.get(type);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(event));
    }
  }
  
  /**
   * Process audio buffer for VAD (alternative to real-time monitoring)
   */
  processAudioBuffer(audioBuffer: Float32Array): VADState {
    // Simple energy-based detection for buffer processing
    let energy = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      energy += audioBuffer[i] * audioBuffer[i];
    }
    energy = 10 * Math.log10(energy / audioBuffer.length);
    
    // Update state
    this.updateState(energy, 0); // No spectral flux for buffer processing
    
    return { ...this.state };
  }
  
  /**
   * Get current state
   */
  getState(): VADState {
    return { ...this.state };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
    
    console.log('[VAD] Configuration updated:', this.config);
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VAD', 'Config updated', this.config);
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.listeners.clear();
    this.previousSpectrum = null;
  }
}

// Export singleton instance
export const vad = new VoiceActivityDetector();