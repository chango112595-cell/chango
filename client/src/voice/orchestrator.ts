/**
 * Voice Orchestrator
 * Integrates VAD, voiceprint gating, barge-in, and auto-idle features
 */

import { voiceBus } from './voiceBus';
import { vad, VADEvent } from './vad';
import { voiceprintEngine } from './security/voiceprint';
import { voiceSecurityStore } from '../state/voiceSecurity';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';
import { beat } from '../dev/health/monitor';
import { alwaysListen } from './always_listen';

export interface OrchestratorConfig {
  vadEnabled: boolean;
  bargeInEnabled: boolean;
  voiceprintGatingEnabled: boolean;
  autoIdleTimeout: number;
  minSpeechDuration: number;
}

export interface OrchestratorState {
  isListening: boolean;
  isSpeaking: boolean;
  isVerified: boolean;
  vadActive: boolean;
  lastActivity: number;
}

/**
 * Voice Orchestrator class
 * Coordinates all voice subsystems
 */
class VoiceOrchestrator {
  private config: OrchestratorConfig;
  private state: OrchestratorState;
  private idleTimer: NodeJS.Timeout | null = null;
  private verificationBuffer: Float32Array[] = [];
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private unsubscribers: (() => void)[] = [];
  private streamRequestInProgress: boolean = false;
  private streamRequestPromise: Promise<MediaStream> | null = null;

  constructor() {
    this.config = {
      vadEnabled: true,
      bargeInEnabled: true,
      voiceprintGatingEnabled: false,
      autoIdleTimeout: 1000,
      minSpeechDuration: 200
    };

    this.state = {
      isListening: false,
      isSpeaking: false,
      isVerified: false,
      vadActive: false,
      lastActivity: Date.now()
    };

    this.initialize();
  }

  /**
   * Initialize orchestrator and set up event handlers
   */
  private async initialize() {
    console.log('[VoiceOrchestrator] Initializing...');

    // Load settings from store
    const settings = voiceSecurityStore.getSettings();
    this.config.vadEnabled = settings.vadEnabled;
    this.config.bargeInEnabled = settings.bargeInEnabled;
    this.config.voiceprintGatingEnabled = settings.requireMatch;
    this.config.autoIdleTimeout = settings.autoIdleTimeout;

    // Subscribe to store changes
    const unsubscribe = voiceSecurityStore.subscribe((state) => {
      this.config.vadEnabled = state.settings.vadEnabled;
      this.config.bargeInEnabled = state.settings.bargeInEnabled;
      this.config.voiceprintGatingEnabled = state.settings.requireMatch;
      this.config.autoIdleTimeout = state.settings.autoIdleTimeout;
      
      console.log('[VoiceOrchestrator] Settings updated:', this.config);
    });
    this.unsubscribers.push(unsubscribe);

    // Set up VAD event handlers
    if (this.config.vadEnabled) {
      await this.setupVAD();
    }

    // Set up voice bus event handlers
    this.setupVoiceBusHandlers();

    console.log('[VoiceOrchestrator] Initialization complete');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VoiceOrchestrator', 'Initialized', this.config);
    }
  }

  /**
   * Get or create a shared audio stream
   * Ensures we only request permission once and reuse the stream
   */
  private async getAudioStream(): Promise<MediaStream | null> {
    // If stream already exists and is active, return it
    if (this.audioStream) {
      const tracks = this.audioStream.getAudioTracks();
      if (tracks.length > 0 && tracks.every(track => track.readyState === 'live')) {
        console.log('[VoiceOrchestrator] Reusing existing audio stream');
        return this.audioStream;
      }
      // Stream exists but tracks are dead, clean it up
      console.log('[VoiceOrchestrator] Existing stream has dead tracks, cleaning up');
      this.cleanupStream();
    }

    // If request is already in progress, wait for it
    if (this.streamRequestInProgress && this.streamRequestPromise) {
      console.log('[VoiceOrchestrator] Stream request already in progress, waiting...');
      try {
        return await this.streamRequestPromise;
      } catch (error) {
        console.error('[VoiceOrchestrator] Stream request failed:', error);
        return null;
      }
    }

    // Create new stream request
    this.streamRequestInProgress = true;
    this.streamRequestPromise = navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    try {
      console.log('[VoiceOrchestrator] Requesting new audio stream...');
      const stream = await this.streamRequestPromise;
      this.audioStream = stream;
      this.streamRequestInProgress = false;
      this.streamRequestPromise = null;
      
      console.log('[VoiceOrchestrator] Successfully obtained audio stream');
      
      // Report heartbeat
      beat('orchestrator', 'stream_obtained');
      
      return stream;
    } catch (error: any) {
      this.streamRequestInProgress = false;
      this.streamRequestPromise = null;
      
      console.error('[VoiceOrchestrator] Failed to get audio stream:', error);
      
      // Handle permission denial gracefully
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.error('[VoiceOrchestrator] Microphone permission denied');
        voiceBus.emitSpeak('Please allow microphone access to use voice features.', 'system');
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.error('VoiceOrchestrator', 'Permission denied', { error: error.name });
        }
      } else if (error.name === 'NotFoundError') {
        console.error('[VoiceOrchestrator] No microphone found');
        voiceBus.emitSpeak('No microphone detected. Please connect a microphone.', 'system');
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.error('VoiceOrchestrator', 'No microphone', { error: error.name });
        }
      }
      
      return null;
    }
  }

  /**
   * Clean up the current audio stream
   */
  private cleanupStream(): void {
    if (this.audioStream) {
      console.log('[VoiceOrchestrator] Cleaning up audio stream');
      this.audioStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[VoiceOrchestrator] Stopped track: ${track.label}`);
      });
      this.audioStream = null;
    }
  }

  /**
   * Setup VAD (Voice Activity Detection)
   */
  private async setupVAD() {
    try {
      // Get shared audio stream
      const stream = await this.getAudioStream();
      
      if (!stream) {
        console.error('[VoiceOrchestrator] Cannot setup VAD without audio stream');
        this.state.vadActive = false;
        return;
      }
      
      // Initialize VAD with stream
      await vad.initialize(stream);
      
      // Subscribe to VAD events
      const unsubSpeechStart = vad.on('speech_start', this.handleSpeechStart.bind(this));
      const unsubSpeechEnd = vad.on('speech_end', this.handleSpeechEnd.bind(this));
      
      this.unsubscribers.push(unsubSpeechStart, unsubSpeechEnd);
      
      // Only start VAD if not gated or already verified
      if (!this.config.voiceprintGatingEnabled || this.state.isVerified) {
        vad.start();
        this.state.vadActive = true;
        console.log('[VoiceOrchestrator] VAD monitoring started');
      } else {
        console.log('[VoiceOrchestrator] VAD initialized but not started (waiting for voiceprint verification)');
      }
      
      console.log('[VoiceOrchestrator] VAD setup complete');
    } catch (error) {
      console.error('[VoiceOrchestrator] Failed to setup VAD:', error);
      this.state.vadActive = false;
    }
  }

  /**
   * Setup voice bus event handlers
   */
  private setupVoiceBusHandlers() {
    // Listen for TTS speak events
    const unsubSpeak = voiceBus.on('speak', (event) => {
      if (event.text && event.source !== 'user') {
        this.handleTTSStart();
      }
    });

    // Listen for TTS speaking state changes
    const unsubSpeaking = voiceBus.on('speakingChange', (event) => {
      if (event.speaking === false) {
        this.handleTTSEnd();
      }
    });

    this.unsubscribers.push(unsubSpeak, unsubSpeaking);
  }

  /**
   * Handle speech start detected by VAD
   */
  private async handleSpeechStart(event: VADEvent) {
    console.log('[VoiceOrchestrator] Speech started');
    
    this.state.lastActivity = Date.now();
    this.cancelIdleTimer();

    // Implement barge-in: stop TTS if user starts speaking
    if (this.config.bargeInEnabled && this.state.isSpeaking) {
      console.log('[VoiceOrchestrator] Barge-in: Stopping TTS');
      voiceBus.cancelSpeak('system');
      this.state.isSpeaking = false;
      
      // Immediately resume STT after barge-in
      if (this.state.isListening) {
        this.resumeSpeechRecognition();
        voiceBus.emit({ type: 'sttResume', source: 'barge-in' });
        console.log('[VoiceOrchestrator] STT resumed after barge-in');
      }
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VoiceOrchestrator', 'Barge-in activated');
      }
    }

    // Check if voiceprint gating is enabled
    if (this.config.voiceprintGatingEnabled && !this.state.isVerified) {
      console.log('[VoiceOrchestrator] Starting voice verification...');
      await this.startVerificationRecording();
    } else {
      // Allow speech recognition to proceed
      this.enableSpeechRecognition();
    }

    // Report heartbeat
    beat('orchestrator', 'speech_detected');
  }

  /**
   * Handle speech end detected by VAD
   */
  private handleSpeechEnd(event: VADEvent) {
    console.log('[VoiceOrchestrator] Speech ended');
    
    // Stop verification recording if active
    if (this.isRecording) {
      this.stopVerificationRecording();
    }

    // Start idle timer for auto-idle
    this.startIdleTimer();

    // Report heartbeat
    beat('orchestrator', 'speech_ended');
  }

  /**
   * Handle TTS start
   */
  private handleTTSStart() {
    console.log('[VoiceOrchestrator] TTS started');
    this.state.isSpeaking = true;
    this.state.lastActivity = Date.now();
    this.cancelIdleTimer();

    // Pause STT while TTS is speaking to prevent self-listening
    if (this.state.isListening) {
      this.pauseSpeechRecognition();
    }
  }

  /**
   * Handle TTS end
   */
  private handleTTSEnd() {
    console.log('[VoiceOrchestrator] TTS ended');
    const wasSpeaking = this.state.isSpeaking;
    this.state.isSpeaking = false;

    // Resume STT after TTS completes
    if (this.state.isListening) {
      this.resumeSpeechRecognition();
      
      // Emit resume event to notify other components
      voiceBus.emit({ type: 'sttResume', source: 'orchestrator' });
      console.log('[VoiceOrchestrator] Emitted STT resume event');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VoiceOrchestrator', 'STT resumed after TTS');
      }
    }

    // If this was from a barge-in, ensure system isn't stuck muted
    if (wasSpeaking) {
      // Report system ready for input
      beat('orchestrator', 'ready_for_input');
    }

    // Start idle timer
    this.startIdleTimer();
  }

  /**
   * Start recording for voiceprint verification
   */
  private async startVerificationRecording() {
    if (this.isRecording) {
      console.log('[VoiceOrchestrator] Already recording, skipping');
      return;
    }

    try {
      // Get shared audio stream
      const stream = await this.getAudioStream();
      
      if (!stream) {
        console.error('[VoiceOrchestrator] Cannot start verification without audio stream');
        return;
      }

      this.isRecording = true;
      this.verificationBuffer = [];

      // Create media recorder using shared stream
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Process verification
        await this.processVerification(chunks);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      
      console.log('[VoiceOrchestrator] Started verification recording');
    } catch (error) {
      console.error('[VoiceOrchestrator] Failed to start verification recording:', error);
      this.isRecording = false;
    }
  }

  /**
   * Stop verification recording
   */
  private stopVerificationRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    try {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      
      console.log('[VoiceOrchestrator] Stopped verification recording');
    } catch (error) {
      console.error('[VoiceOrchestrator] Failed to stop verification recording:', error);
    }
  }

  /**
   * Process voiceprint verification
   */
  private async processVerification(chunks: Blob[]) {
    let audioContext: AudioContext | null = null;
    
    try {
      // Get active voiceprint
      const activeVoiceprint = voiceSecurityStore.getActiveVoiceprint();
      if (!activeVoiceprint) {
        console.warn('[VoiceOrchestrator] No active voiceprint for verification');
        this.state.isVerified = false;
        return;
      }

      // Convert audio to Float32Array
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Create AudioContext with proper cleanup
      audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      // Verify against stored voiceprint
      const settings = voiceSecurityStore.getSettings();
      const result = await voiceprintEngine.verify(
        channelData,
        activeVoiceprint,
        settings.matchThreshold,
        audioBuffer.sampleRate
      );

      this.state.isVerified = result.match;
      voiceSecurityStore.recordVerification(result.match, result.similarity);

      console.log('[VoiceOrchestrator] Verification result:', result);

      if (result.match) {
        // Voice verified - enable speech recognition and VAD
        this.enableSpeechRecognition();
        
        // Start VAD now that verification passed
        if (this.config.vadEnabled && !this.state.vadActive) {
          console.log('[VoiceOrchestrator] Starting VAD after successful verification');
          vad.start();
          this.state.vadActive = true;
        }
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.info('VoiceOrchestrator', 'Voice verified', { similarity: result.similarity });
        }
      } else {
        // Voice not matched - deny access
        console.warn('[VoiceOrchestrator] Voice verification failed');
        voiceBus.emitSpeak('Voice not recognized. Please try again.', 'system');
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.warn('VoiceOrchestrator', 'Voice verification failed', { similarity: result.similarity });
        }
      }
    } catch (error) {
      console.error('[VoiceOrchestrator] Verification processing error:', error);
      this.state.isVerified = false;
    } finally {
      // Always clean up AudioContext
      if (audioContext) {
        try {
          await audioContext.close();
          console.log('[VoiceOrchestrator] AudioContext closed');
        } catch (closeError) {
          console.error('[VoiceOrchestrator] Failed to close AudioContext:', closeError);
        }
      }
    }
  }

  /**
   * Enable speech recognition
   */
  private enableSpeechRecognition() {
    if (!this.state.isListening) {
      this.state.isListening = true;
      console.log('[VoiceOrchestrator] Speech recognition enabled');
      
      // Enable the always listen module
      if (alwaysListen && !alwaysListen.getStatus().isListening) {
        alwaysListen.start();
      }
    }
  }

  /**
   * Pause speech recognition (during TTS)
   */
  private pauseSpeechRecognition() {
    console.log('[VoiceOrchestrator] Pausing speech recognition');
    // Temporarily pause without disabling
    if (alwaysListen && alwaysListen.getStatus().isListening) {
      // Keep the state but pause actual recognition
      // This is handled by the always_listen module's internal logic
    }
  }

  /**
   * Resume speech recognition
   */
  private resumeSpeechRecognition() {
    console.log('[VoiceOrchestrator] Resuming speech recognition');
    if (this.state.isListening && alwaysListen) {
      // Resume if it was paused
      if (!alwaysListen.getStatus().isListening) {
        alwaysListen.start();
      }
    }
  }

  /**
   * Disable speech recognition
   */
  private disableSpeechRecognition() {
    if (this.state.isListening) {
      this.state.isListening = false;
      console.log('[VoiceOrchestrator] Speech recognition disabled');
      
      // Stop the always listen module
      if (alwaysListen && alwaysListen.getStatus().isListening) {
        alwaysListen.stop();
      }
    }
  }

  /**
   * Start idle timer
   */
  private startIdleTimer() {
    this.cancelIdleTimer();
    
    if (this.config.autoIdleTimeout > 0) {
      this.idleTimer = setTimeout(() => {
        this.handleIdle();
      }, this.config.autoIdleTimeout);
    }
  }

  /**
   * Cancel idle timer
   */
  private cancelIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Handle idle state (auto-idle after silence)
   */
  private handleIdle() {
    const timeSinceActivity = Date.now() - this.state.lastActivity;
    
    if (timeSinceActivity >= this.config.autoIdleTimeout) {
      console.log('[VoiceOrchestrator] Auto-idle triggered after', timeSinceActivity, 'ms of inactivity');
      
      // Disable speech recognition to save resources
      this.disableSpeechRecognition();
      
      // Reset verification state
      this.state.isVerified = false;
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VoiceOrchestrator', 'Auto-idle activated', { 
          inactivityDuration: timeSinceActivity 
        });
      }
      
      // Report heartbeat
      beat('orchestrator', 'auto_idle');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OrchestratorConfig>) {
    this.config = { ...this.config, ...config };
    console.log('[VoiceOrchestrator] Configuration updated:', this.config);
    
    // Restart VAD if needed
    if (config.vadEnabled !== undefined) {
      if (config.vadEnabled && !this.state.vadActive) {
        this.setupVAD();
      } else if (!config.vadEnabled && this.state.vadActive) {
        vad.stop();
        this.state.vadActive = false;
      }
    }
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Manual trigger for voice verification
   */
  async triggerVerification(): Promise<boolean> {
    if (!this.config.voiceprintGatingEnabled) {
      return true;
    }

    // Start verification process
    this.startVerificationRecording();
    
    // Wait for verification to complete (timeout after 3 seconds)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.stopVerificationRecording();
        resolve(this.state.isVerified);
      }, 3000);

      // Check verification state periodically
      const checkInterval = setInterval(() => {
        if (this.state.isVerified) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    console.log('[VoiceOrchestrator] Destroying...');
    
    // Stop recording first
    if (this.isRecording) {
      this.stopVerificationRecording();
    }
    
    // Stop VAD and cleanup its resources
    if (this.state.vadActive) {
      vad.stop();
      vad.destroy();
      this.state.vadActive = false;
    }
    
    // Unsubscribe from all events
    this.unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        console.warn('[VoiceOrchestrator] Error unsubscribing:', error);
      }
    });
    this.unsubscribers = [];
    
    // Clean up MediaRecorder
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
      } catch (error) {
        console.warn('[VoiceOrchestrator] Error stopping MediaRecorder:', error);
      }
    }
    
    // Clean up audio stream
    this.cleanupStream();
    
    // Cancel all timers
    this.cancelIdleTimer();
    
    // Reset state
    this.state = {
      isListening: false,
      isSpeaking: false,
      isVerified: false,
      vadActive: false,
      lastActivity: Date.now()
    };
    
    // Clear any pending stream requests
    this.streamRequestInProgress = false;
    this.streamRequestPromise = null;
    
    console.log('[VoiceOrchestrator] Destroyed successfully');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VoiceOrchestrator', 'Resources cleaned up');
    }
  }
}

// Export singleton instance
export const voiceOrchestrator = new VoiceOrchestrator();