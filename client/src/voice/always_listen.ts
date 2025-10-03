/**
 * Always Listen Module - Robust STT Engine
 * Implements continuous listening with auto-restart and error recovery
 * Features:
 * - Idempotent initialization
 * - Automatic error recovery
 * - Health monitoring integration
 * - Debug bus logging
 * - Graceful handling of all Web Speech API errors
 */

import { voiceBus } from './voiceBus';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';
import { beat } from '../dev/health/monitor';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  readonly message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

// Extend Window interface to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export interface AlwaysListenConfig {
  autoRestart?: boolean;
  pauseOnHidden?: boolean;
  restartDelay?: number;
  noSpeechTimeout?: number;
  maxRestartAttempts?: number;
  language?: string;
}

type RecognitionState = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';

class AlwaysListenManager {
  private recognition: SpeechRecognition | null = null;
  private state: RecognitionState = 'idle';
  private isEnabled: boolean = false;
  private hasPermission: boolean = false;
  private config: Required<AlwaysListenConfig>;
  private restartTimer: NodeJS.Timeout | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private lastInterimTranscript: string = '';
  private restartAttempts: number = 0;
  private lastErrorTime: number = 0;
  private errorCount: number = 0;
  private isInitialized: boolean = false;
  private microphoneAvailable: boolean = false;
  private microphoneMuted: boolean = false;
  private permissionCheckTimer: NodeJS.Timeout | null = null;
  private lastPermissionCheck: number = 0;

  constructor() {
    this.config = {
      autoRestart: true,
      pauseOnHidden: true,
      restartDelay: 500,
      noSpeechTimeout: 10000,
      maxRestartAttempts: 5,
      language: 'en-US'
    };

    // Setup visibility change handler
    if (this.config.pauseOnHidden) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Check microphone permission and availability
   */
  async checkMicrophonePermission(): Promise<{
    hasPermission: boolean;
    microphoneAvailable: boolean;
    microphoneMuted: boolean;
    errorType?: string;
  }> {
    const now = Date.now();
    
    // Avoid checking too frequently
    if (now - this.lastPermissionCheck < 1000) {
      return {
        hasPermission: this.hasPermission,
        microphoneAvailable: this.microphoneAvailable,
        microphoneMuted: this.microphoneMuted
      };
    }
    
    this.lastPermissionCheck = now;
    
    try {
      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('[AlwaysListen] MediaDevices API not available');
        return {
          hasPermission: false,
          microphoneAvailable: false,
          microphoneMuted: false,
          errorType: 'api-not-available'
        };
      }

      // Try to get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Check if we got a valid stream
      const audioTracks = stream.getAudioTracks();
      
      if (audioTracks.length === 0) {
        console.warn('[AlwaysListen] No audio tracks available');
        stream.getTracks().forEach(track => track.stop());
        return {
          hasPermission: false,
          microphoneAvailable: false,
          microphoneMuted: false,
          errorType: 'no-audio-tracks'
        };
      }

      // Check track state
      const track = audioTracks[0];
      const trackEnabled = track.enabled;
      const trackMuted = track.muted;
      const trackReadyState = track.readyState;
      
      console.log('[AlwaysListen] Audio track state:', {
        enabled: trackEnabled,
        muted: trackMuted,
        readyState: trackReadyState,
        label: track.label
      });

      // Clean up stream
      stream.getTracks().forEach(track => track.stop());

      // Update state based on track info
      this.hasPermission = true;
      this.microphoneAvailable = trackReadyState === 'live';
      this.microphoneMuted = trackMuted;

      if (trackMuted) {
        console.warn('[AlwaysListen] Microphone is muted at browser/OS level');
        if (FEATURES.DEBUG_BUS) {
          debugBus.warn('AlwaysListen', 'Microphone is muted', { 
            trackState: { enabled: trackEnabled, muted: trackMuted, readyState: trackReadyState }
          });
        }
      }

      return {
        hasPermission: true,
        microphoneAvailable: this.microphoneAvailable,
        microphoneMuted: this.microphoneMuted
      };

    } catch (error: any) {
      console.error('[AlwaysListen] Permission check failed:', error);
      
      // Analyze error type
      let errorType = 'unknown';
      let hasPermission = false;
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorType = 'permission-denied';
        console.error('[AlwaysListen] Microphone permission denied by user');
      } else if (error.name === 'NotFoundError' || error.name === 'DeviceNotFoundError') {
        errorType = 'no-microphone';
        console.error('[AlwaysListen] No microphone device found');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorType = 'device-in-use';
        console.error('[AlwaysListen] Microphone may be in use by another application');
      } else if (error.name === 'OverconstrainedError') {
        errorType = 'constraints-error';
        console.error('[AlwaysListen] Audio constraints could not be satisfied');
      }
      
      this.hasPermission = hasPermission;
      this.microphoneAvailable = false;
      this.microphoneMuted = false;
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'Permission check failed', { 
          errorName: error.name,
          errorMessage: error.message,
          errorType
        });
      }
      
      return {
        hasPermission,
        microphoneAvailable: false,
        microphoneMuted: false,
        errorType
      };
    }
  }

  /**
   * Initialize continuous listening (idempotent)
   */
  async initialize(): Promise<void> {
    // Idempotent - return if already initialized
    if (this.isInitialized) {
      console.log('[AlwaysListen] Already initialized, skipping...');
      return;
    }

    console.log('[AlwaysListen] Initializing continuous listening...');
    
    // Log to debug bus
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'Initializing', { 
        config: this.config,
        state: this.state 
      });
    }
    
    // Check for browser support
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      const error = 'Speech recognition not supported in this browser';
      console.error('[AlwaysListen]', error);
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', error);
      }
      throw new Error(error);
    }

    try {
      // Create recognition instance
      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = 1;

      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      console.log('[AlwaysListen] Initialization complete');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Initialized successfully');
      }
    } catch (error) {
      console.error('[AlwaysListen] Failed to initialize:', error);
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'Initialization failed', { error });
      }
      throw error;
    }
  }

  /**
   * Start listening (idempotent)
   */
  async start(): Promise<void> {
    // Initialize if needed
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Idempotent - return if already enabled and listening
    if (this.isEnabled && (this.state === 'listening' || this.state === 'starting')) {
      console.log('[AlwaysListen] Already enabled and listening/starting');
      return;
    }

    console.log('[AlwaysListen] Starting speech recognition...');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'Starting', { 
        previousState: this.state 
      });
    }

    this.isEnabled = true;
    this.restartAttempts = 0;
    
    // Start recognition
    this.startRecognition();
  }

  /**
   * Stop listening
   */
  stop(): void {
    console.log('[AlwaysListen] Stopping continuous listening...');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'Stopping', { 
        state: this.state 
      });
    }
    
    this.isEnabled = false;
    this.clearTimers();

    if (this.recognition && (this.state === 'listening' || this.state === 'starting')) {
      this.state = 'stopping';
      try {
        this.recognition.abort();
      } catch (error) {
        console.warn('[AlwaysListen] Error aborting recognition:', error);
      }
    }
    
    this.state = 'idle';
  }

  /**
   * Setup speech recognition event handlers
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    // Handle recognition start
    this.recognition.onstart = () => {
      console.log('[AlwaysListen] 🎤 Recognition started');
      this.state = 'listening';
      this.restartAttempts = 0;
      this.hasPermission = true;
      
      // Send heartbeat
      beat('stt', { status: 'started' });
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Recognition started');
      }
    };

    // Handle recognition end
    this.recognition.onend = () => {
      console.log('[AlwaysListen] 🔴 Recognition ended');
      
      const wasListening = this.state === 'listening';
      this.state = 'idle';
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Recognition ended', { 
          wasListening,
          willRestart: this.isEnabled && this.config.autoRestart 
        });
      }
      
      // Auto-restart if enabled
      if (this.isEnabled && this.config.autoRestart) {
        this.scheduleRestart();
      }
    };

    // Handle recognition results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleResults(event);
    };

    // Handle recognition errors
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.handleError(event);
    };

    // Handle speech detection
    this.recognition.onspeechstart = () => {
      console.log('[AlwaysListen] 🗣️ Speech detected');
      
      // Send heartbeat
      beat('stt', { status: 'speech_detected' });
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Speech detected');
      }
    };

    this.recognition.onspeechend = () => {
      console.log('[AlwaysListen] 🤐 Speech ended');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Speech ended');
      }
      
      // Process any pending interim transcript
      this.processPendingTranscript();
    };
  }

  /**
   * Handle recognition results
   */
  private handleResults(event: SpeechRecognitionEvent): void {
    console.log('[AlwaysListen] 📝 Processing recognition results...');
    
    // Send heartbeat
    beat('stt', { hasResults: true });
    
    let finalTranscript = '';
    let interimTranscript = '';
    
    // Process results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      
      if (result.isFinal) {
        finalTranscript = transcript;
        console.log('[AlwaysListen] ✅ Final:', finalTranscript);
      } else {
        interimTranscript = transcript;
        this.lastInterimTranscript = transcript;
        console.log('[AlwaysListen] 💬 Interim:', interimTranscript);
      }
    }
    
    // Emit final transcript
    if (finalTranscript) {
      this.emitTranscript(finalTranscript, true);
      this.lastInterimTranscript = '';
    }
    
    // Log interim transcript
    if (interimTranscript && FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'Interim transcript', { text: interimTranscript });
    }
  }

  /**
   * Handle recognition errors
   */
  private async handleError(event: SpeechRecognitionErrorEvent): Promise<void> {
    const now = Date.now();
    
    // Track error rate
    if (now - this.lastErrorTime < 5000) {
      this.errorCount++;
    } else {
      this.errorCount = 1;
    }
    this.lastErrorTime = now;

    console.warn('[AlwaysListen] Recognition error:', event.error, event.message || '');
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.warn('AlwaysListen', `Error: ${event.error}`, { 
        message: event.message,
        errorCount: this.errorCount 
      });
    }

    switch (event.error) {
      case 'no-speech':
        // Normal timeout - just restart
        console.log('[AlwaysListen] No speech detected, will restart');
        if (this.isEnabled) {
          this.scheduleRestart(100);
        }
        break;

      case 'not-allowed':
        // Permission denied - check actual permission state
        console.error('[AlwaysListen] Permission error detected, checking actual state...');
        
        const permissionStatus = await this.checkMicrophonePermission();
        
        if (!permissionStatus.hasPermission) {
          console.error('[AlwaysListen] Confirmed: Microphone permission denied');
          this.hasPermission = false;
          this.state = 'error';
          
          if (FEATURES.DEBUG_BUS) {
            debugBus.error('AlwaysListen', 'Permission denied', permissionStatus);
          }
          
          // Start monitoring for permission changes
          this.startPermissionMonitoring();
        } else {
          // Permission is actually granted, might be a transient error
          console.log('[AlwaysListen] Permission check passed, likely transient error');
          if (this.isEnabled) {
            this.scheduleRestart(1000);
          }
        }
        break;

      case 'audio-capture':
        // Audio capture failed - could be muted mic or no device
        console.error('[AlwaysListen] Audio capture failed, checking microphone status...');
        
        // Check if it's because the source is muted
        if (event.message && event.message.includes('muted')) {
          console.warn('[AlwaysListen] Microphone appears to be muted');
          this.microphoneMuted = true;
          
          // Check actual permission/device state
          const micStatus = await this.checkMicrophonePermission();
          
          if (!micStatus.hasPermission) {
            console.error('[AlwaysListen] No microphone permission');
            this.hasPermission = false;
            this.startPermissionMonitoring();
          } else if (micStatus.microphoneMuted) {
            console.warn('[AlwaysListen] Microphone is muted at browser/OS level');
            if (FEATURES.DEBUG_BUS) {
              debugBus.warn('AlwaysListen', 'Microphone muted', { 
                message: 'Please unmute your microphone to use voice commands'
              });
            }
            // Start monitoring for when mic becomes unmuted
            this.startMicrophoneMonitoring();
          } else if (!micStatus.microphoneAvailable) {
            console.error('[AlwaysListen] No microphone device available');
            if (FEATURES.DEBUG_BUS) {
              debugBus.error('AlwaysListen', 'No microphone device', { 
                message: 'Please connect a microphone to use voice commands'
              });
            }
            // Start monitoring for when mic becomes available
            this.startMicrophoneMonitoring();
          }
        }
        
        this.state = 'error';
        
        // Try to restart after delay
        if (this.isEnabled && this.restartAttempts < this.config.maxRestartAttempts) {
          this.scheduleRestart(3000);
        }
        break;

      case 'network':
        // Network error - retry
        console.error('[AlwaysListen] Network error');
        if (this.isEnabled) {
          this.scheduleRestart(1000);
        }
        break;

      case 'aborted':
        // Recognition aborted - restart if enabled
        console.log('[AlwaysListen] Recognition aborted');
        if (this.isEnabled) {
          this.scheduleRestart(200);
        }
        break;

      default:
        // Unknown error - try to restart
        console.error('[AlwaysListen] Unknown error:', event.error);
        if (this.isEnabled && this.restartAttempts < this.config.maxRestartAttempts) {
          this.scheduleRestart(1000);
        }
        break;
    }
  }

  /**
   * Emit transcript to voice bus
   */
  private emitTranscript(text: string, isFinal: boolean): void {
    if (!text || text.length === 0) return;

    console.log(`[AlwaysListen] 🚀 Emitting ${isFinal ? 'final' : 'interim'} transcript:`, text);
    
    try {
      // Get current state
      const state = voiceBus.getState();
      
      // Emit event
      voiceBus.emit({
        type: 'userSpeechRecognized',
        text: text,
        source: 'user',
        state: state
      });
      
      console.log('[AlwaysListen] ✓ Successfully emitted to voiceBus');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', `Emitted ${isFinal ? 'final' : 'interim'} transcript`, { text });
      }
    } catch (error) {
      console.error('[AlwaysListen] ❌ Failed to emit to voiceBus:', error);
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'Failed to emit transcript', { error });
      }
    }
  }

  /**
   * Process any pending interim transcript
   */
  private processPendingTranscript(): void {
    if (this.lastInterimTranscript && this.lastInterimTranscript.trim()) {
      console.log('[AlwaysListen] ⚡ Processing pending interim transcript as final');
      this.emitTranscript(this.lastInterimTranscript.trim(), true);
      this.lastInterimTranscript = '';
    }
  }

  /**
   * Start speech recognition with error handling
   */
  private async startRecognition(): Promise<void> {
    if (!this.recognition || !this.isEnabled) return;
    
    // Check current state
    if (this.state === 'listening' || this.state === 'starting') {
      console.log('[AlwaysListen] Already starting/listening, skipping start');
      return;
    }
    
    // Check microphone permission first
    console.log('[AlwaysListen] Checking microphone permission before starting...');
    const permissionStatus = await this.checkMicrophonePermission();
    
    if (!permissionStatus.hasPermission) {
      console.error('[AlwaysListen] Cannot start: No microphone permission');
      this.state = 'error';
      this.hasPermission = false;
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'Cannot start - no permission', permissionStatus);
      }
      
      // Start monitoring for permission
      this.startPermissionMonitoring();
      return;
    }
    
    if (permissionStatus.microphoneMuted) {
      console.warn('[AlwaysListen] Warning: Microphone is muted');
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('AlwaysListen', 'Starting with muted microphone', permissionStatus);
      }
    }
    
    if (!permissionStatus.microphoneAvailable) {
      console.error('[AlwaysListen] Cannot start: No microphone available');
      this.state = 'error';
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'Cannot start - no microphone', permissionStatus);
      }
      
      // Start monitoring for microphone
      this.startMicrophoneMonitoring();
      return;
    }
    
    this.state = 'starting';
    
    try {
      this.recognition.start();
      console.log('[AlwaysListen] Recognition start requested');
    } catch (error: any) {
      console.error('[AlwaysListen] Failed to start recognition:', error);
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'Start failed', { error: error?.message });
      }
      
      // If already started error, try abort then restart
      if (error?.message?.includes('already started')) {
        console.log('[AlwaysListen] Recognition already started, aborting and restarting...');
        try {
          this.recognition.abort();
        } catch (abortError) {
          console.warn('[AlwaysListen] Error aborting:', abortError);
        }
        this.scheduleRestart(500);
      } else {
        // Other error - schedule restart
        this.state = 'error';
        if (this.isEnabled) {
          this.scheduleRestart(1000);
        }
      }
    }
  }

  /**
   * Schedule a restart with debouncing
   */
  private scheduleRestart(delay?: number): void {
    // Clear existing timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    
    const restartDelay = delay ?? this.config.restartDelay;
    
    console.log(`[AlwaysListen] Scheduling restart in ${restartDelay}ms...`);
    
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      
      if (!this.isEnabled) {
        console.log('[AlwaysListen] Not restarting - disabled');
        return;
      }
      
      this.restartAttempts++;
      
      if (this.restartAttempts > this.config.maxRestartAttempts) {
        console.error('[AlwaysListen] Max restart attempts reached');
        this.state = 'error';
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.error('AlwaysListen', 'Max restart attempts reached', {
            attempts: this.restartAttempts
          });
        }
        
        // Reset attempts counter after longer delay
        setTimeout(() => {
          this.restartAttempts = 0;
          if (this.isEnabled) {
            this.startRecognition();
          }
        }, 10000);
        return;
      }
      
      console.log(`[AlwaysListen] Restarting (attempt ${this.restartAttempts}/${this.config.maxRestartAttempts})...`);
      this.startRecognition();
    }, restartDelay);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.permissionCheckTimer) {
      clearInterval(this.permissionCheckTimer);
      this.permissionCheckTimer = null;
    }
  }

  /**
   * Start monitoring for permission changes
   */
  private startPermissionMonitoring(): void {
    // Clear existing timer if any
    if (this.permissionCheckTimer) {
      clearInterval(this.permissionCheckTimer);
    }
    
    console.log('[AlwaysListen] Starting permission monitoring...');
    
    // Check every 3 seconds for permission
    this.permissionCheckTimer = setInterval(async () => {
      const status = await this.checkMicrophonePermission();
      
      if (status.hasPermission && this.isEnabled && this.state === 'error') {
        console.log('[AlwaysListen] Permission granted! Attempting to restart...');
        
        // Clear the timer
        clearInterval(this.permissionCheckTimer!);
        this.permissionCheckTimer = null;
        
        // Update state
        this.hasPermission = true;
        this.microphoneAvailable = status.microphoneAvailable;
        this.microphoneMuted = status.microphoneMuted;
        
        // Reset error state and restart
        this.restartAttempts = 0;
        this.state = 'idle';
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.info('AlwaysListen', 'Permission recovered', status);
        }
        
        // Restart recognition
        this.startRecognition();
      }
    }, 3000);
  }

  /**
   * Start monitoring for microphone availability
   */
  private startMicrophoneMonitoring(): void {
    // Clear existing timer if any
    if (this.permissionCheckTimer) {
      clearInterval(this.permissionCheckTimer);
    }
    
    console.log('[AlwaysListen] Starting microphone monitoring...');
    
    // Check every 3 seconds for microphone status
    this.permissionCheckTimer = setInterval(async () => {
      const status = await this.checkMicrophonePermission();
      
      if (status.hasPermission && status.microphoneAvailable && !status.microphoneMuted) {
        console.log('[AlwaysListen] Microphone available and unmuted! Attempting to restart...');
        
        // Clear the timer
        clearInterval(this.permissionCheckTimer!);
        this.permissionCheckTimer = null;
        
        // Update state
        this.hasPermission = true;
        this.microphoneAvailable = true;
        this.microphoneMuted = false;
        
        // Reset error state and restart
        this.restartAttempts = 0;
        this.state = 'idle';
        
        if (FEATURES.DEBUG_BUS) {
          debugBus.info('AlwaysListen', 'Microphone recovered', status);
        }
        
        // Restart recognition if enabled
        if (this.isEnabled) {
          this.startRecognition();
        }
      } else if (status.hasPermission && status.microphoneAvailable && status.microphoneMuted) {
        // Microphone is still muted
        if (this.microphoneMuted !== true) {
          console.warn('[AlwaysListen] Microphone is muted - waiting for unmute...');
          this.microphoneMuted = true;
          
          if (FEATURES.DEBUG_BUS) {
            debugBus.warn('AlwaysListen', 'Microphone still muted', { 
              message: 'Please unmute your microphone to use voice commands'
            });
          }
        }
      }
    }, 3000);
  }

  /**
   * Handle tab visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('[AlwaysListen] Tab hidden - pausing recognition');
      if (this.state === 'listening') {
        try {
          this.recognition?.stop();
        } catch (error) {
          console.warn('[AlwaysListen] Error stopping on visibility change:', error);
        }
      }
    } else {
      console.log('[AlwaysListen] Tab visible - resuming recognition');
      if (this.isEnabled && this.state === 'idle') {
        this.startRecognition();
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthTimer) return;
    
    // Send heartbeat every 5 seconds when enabled
    this.healthTimer = setInterval(() => {
      if (this.isEnabled) {
        beat('stt', { 
          state: this.state,
          hasPermission: this.hasPermission,
          restartAttempts: this.restartAttempts,
          errorCount: this.errorCount
        });
      }
    }, 5000);
  }

  /**
   * Get current status
   */
  getStatus(): {
    isEnabled: boolean;
    isListening: boolean;
    hasPermission: boolean;
    state: RecognitionState;
    restartAttempts: number;
    errorCount: number;
    microphoneAvailable: boolean;
    microphoneMuted: boolean;
  } {
    return {
      isEnabled: this.isEnabled,
      isListening: this.state === 'listening',
      hasPermission: this.hasPermission,
      state: this.state,
      restartAttempts: this.restartAttempts,
      errorCount: this.errorCount,
      microphoneAvailable: this.microphoneAvailable,
      microphoneMuted: this.microphoneMuted
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    
    // Remove event listeners
    if (this.config.pauseOnHidden) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    
    this.recognition = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
const alwaysListen = new AlwaysListenManager();

// Expose to window for debugging in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__ALWAYS_LISTEN__ = alwaysListen;
}

export { alwaysListen };
export type { AlwaysListenManager };