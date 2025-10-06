/**
 * Always Listen Module - Robust STT Engine with Enhanced Permission Handling
 * Implements continuous listening with auto-restart and error recovery
 * Features:
 * - Enhanced permission checks with fallback logic
 * - iOS AudioContext support with better handling
 * - Wake word integration for Chango
 * - Improved debug monitoring
 * - iOS-specific retry mechanisms
 */

import { checkMicPermission, requestMicStream, unlockAudioContext } from '../lib/permissions';
import { ensureMicReady } from '../lib/audio/ensureMicReady';
import { getMicrophonePermission, requestMicrophoneIfNeeded } from '../lib/permissions/microphone';
import { ensureAudioUnlockedOnce } from '../lib/audio/unlockAudio';
import { voiceBus } from './voiceBus';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';
import { beat } from '../dev/health/monitor';
import { startSTT, stopSTT } from './stt';
import { voiceGate } from '../core/gate';
import { moduleRegistry, ModuleType } from '../dev/moduleRegistry';
import { GlobalMonitor } from '../monitor/GlobalMonitor';
import { DuplexGuard } from './duplexGuard';
import { handleUserUtterance } from '../lib/orchestrator';
import { isDuplicate } from '../lib/voice/dupGuard';
import { sttHeartbeatOk } from '../monitor/sttHealth';

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

// Extend Window interface to include SpeechRecognition and singleton tracking
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    __alwaysListenInstance?: AlwaysListenManager;
    __alwaysListenActive?: boolean;
    __alwaysListenCreatedAt?: number;
    __alwaysListenDisposedAt?: number;
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

export type AlwaysCfg = { wakeWord?: string; enabled: boolean };

type RecognitionState = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';

// New enhanced functions for better permission handling
let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let running = false;

// Idempotent flags to avoid rapid loops
let starting = false;
let sttActive = false;

export async function ensureAudioUnlocked() {
  if (!ctx) ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  if (ctx) {
    await unlockAudioContext(ctx);
  }
}

async function acquireMic() {
  const state = await checkMicPermission();
  debugBus.info('AlwaysListen', `Permission state: ${state}`);

  if (state === 'denied' || state === 'blocked') {
    debugBus.error('Gate', 'Microphone permission denied/blocked');
    
    // On iOS, provide more guidance
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.warn('[AlwaysListen] iOS detected - permission may need to be granted in Settings');
    }
    
    throw new Error('mic_denied');
  }
  stream = await requestMicStream();
  debugBus.info('STT', 'Mic stream acquired');
  return stream;
}

export async function startAlwaysListenNew(cfg: AlwaysCfg) {
  // Import isPermissionDenied from microphone module
  const { isPermissionDenied } = await import('@/lib/permissions/microphone');
  
  // Check if permission was denied - don't even try if it was
  if (isPermissionDenied()) {
    debugBus.error('AlwaysListen', 'Microphone permission was denied - not attempting to start STT', {
      action: 'Please enable microphone in browser settings',
      permanentlyDenied: true
    });
    beat('stt', { status: 'error', hasPermission: false, reason: 'permission_denied' });
    return;
  }
  
  // Check if already starting or active to avoid duplicates
  if (starting || sttActive || !cfg.enabled) {
    debugBus.info('AlwaysListen', `Already starting/active or disabled (starting=${starting}, active=${sttActive}, enabled=${cfg.enabled})`);
    return;
  }
  
  starting = true; // Set flag to prevent rapid loops
  
  try {
    // Call ensureAudioUnlockedOnce() for mobile audio
    ensureAudioUnlockedOnce();
    debugBus.info('AlwaysListen', 'Audio unlock initiated');
    
    // Check microphone permission state
    const permissionState = await getMicrophonePermission();
    debugBus.info('AlwaysListen', `Permission state: ${permissionState}`);
    
    // Stop immediately if permission is denied
    if (permissionState === 'denied') {
      debugBus.error('AlwaysListen', 'Microphone permission is denied - stopping', {
        action: 'User must enable microphone in browser settings',
        permanentlyDenied: true
      });
      starting = false;
      beat('stt', { status: 'error', hasPermission: false, reason: 'permission_denied' });
      return;
    }
    
    // Request permission if needed
    if (permissionState === 'prompt') {
      debugBus.info('AlwaysListen', 'Requesting microphone permission...');
      const granted = await requestMicrophoneIfNeeded();
      if (!granted) {
        debugBus.error('AlwaysListen', 'Microphone permission denied by user', {
          action: 'Permission must be granted to use voice features',
          permanentlyDenied: isPermissionDenied()
        });
        starting = false;
        beat('stt', { status: 'error', hasPermission: false, reason: 'permission_denied' });
        return;
      }
      debugBus.info('AlwaysListen', 'Microphone permission granted');
    } else if (permissionState === 'unsupported') {
      debugBus.warn('AlwaysListen', 'Permission API not supported, attempting to continue');
    }
    
    // Only start STT if permission is granted or unsupported (fallback for older browsers)
    if (permissionState === 'granted' || permissionState === 'unsupported') {
      // Use ensureMicReady for robust iOS mic bootstrap
      // This handles AudioContext resume and mic permission in one call
      stream = await ensureMicReady();
      debugBus.info('STT', 'Mic ready via ensureMicReady');
      
      await startSTT();                   // your STT module starts listening

      // Optional: gate by wake-word
      if (cfg.wakeWord) voiceGate.open();
      
      // Set appropriate flags
      running = true;
      sttActive = true;
      
      // Update debug flags
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'STT started successfully');
      }
      
      // Send heartbeat
      beat('stt', { status: 'started', hasPermission: true });
    } else {
      debugBus.error('AlwaysListen', `Cannot start STT - permission state: ${permissionState}`, {
        state: permissionState,
        action: 'Check browser settings'
      });
      beat('stt', { status: 'error', hasPermission: false, reason: 'invalid_state' });
    }
  } catch (e:any) {
    running = false;
    sttActive = false;
    
    const errorMsg = e?.message || e || 'Unknown error';
    
    // Check if it's a permission error
    if (errorMsg.includes('not allowed') || 
        errorMsg.includes('Permission denied') ||
        errorMsg.includes('NotAllowedError') ||
        errorMsg.includes('audio-capture') ||
        errorMsg.includes('mic_denied')) {
      debugBus.error('AlwaysListen', 'Permission error detected - will not retry', {
        error: errorMsg,
        permanentlyDenied: true,
        action: 'Enable microphone in browser settings'
      });
      beat('stt', { status: 'error', hasPermission: false, reason: 'permission_error' });
    } else {
      debugBus.error('AlwaysListen', `Startup failed: ${errorMsg}`, {
        error: errorMsg,
        willRetry: false
      });
      // Send error heartbeat
      beat('stt', { status: 'error', hasPermission: false, reason: 'startup_failed' });
    }
  } finally {
    starting = false; // Clear starting flag in all cases
  }
}

export async function stopAlwaysListenNew() {
  try {
    voiceGate.close();
    await stopSTT();
  } finally {
    if (stream) { 
      stream.getTracks().forEach(t => t.stop()); 
      stream = null; 
    }
    running = false;
    sttActive = false; // Clear the sttActive flag
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'STT stopped');
    }
    
    // Send stopped heartbeat
    beat('stt', { status: 'stopped' });
  }
}

// Export function to check if AlwaysListen is active
export function isAlwaysListenActive(): boolean {
  return sttActive;
}

class AlwaysListenManager {
  // Singleton instance and tracking
  private static instance: AlwaysListenManager | null = null;
  private static isCreating: boolean = false;
  
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
  
  // Exponential backoff and consecutive failure tracking
  private consecutiveFailures: number = 0;
  private currentRetryDelay: number = 500; // Start at 500ms
  private readonly MAX_RETRY_DELAY: number = 10000; // Max 10 seconds
  private readonly MAX_CONSECUTIVE_FAILURES: number = 10;
  private readonly MUTED_RETRY_DELAY: number = 5000; // 5 seconds for muted mic
  private isPausedForRecovery: boolean = false;
  private lastSuccessfulRecognition: number = Date.now();
  private errorMessage: string = '';
  private isStartingRecognition: boolean = false; // Global flag to prevent concurrent starts
  
  // Lifecycle tracking
  private instanceCreatedAt: number;
  private instanceDisposedAt: number | null = null;
  
  // Operation guards
  private operationInProgress: boolean = false;
  private lastOperation: string = '';

  // Private constructor for singleton pattern
  private constructor() {
    // Track creation time
    this.instanceCreatedAt = Date.now();
    this.instanceDisposedAt = null;
    
    // Set global window flags
    window.__alwaysListenInstance = this;
    window.__alwaysListenActive = false;
    window.__alwaysListenCreatedAt = this.instanceCreatedAt;
    
    // Log singleton creation
    console.log(`[AlwaysListen] 🚀 Singleton instance created at ${new Date(this.instanceCreatedAt).toISOString()}`);
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'Singleton created', {
        createdAt: new Date(this.instanceCreatedAt).toISOString()
      });
    }
    
    this.config = {
      autoRestart: true,
      pauseOnHidden: true,
      restartDelay: 1500, // Increased from 500ms to 1500ms to prevent rapid restarts
      noSpeechTimeout: 10000,
      maxRestartAttempts: 5,
      language: 'en-US'
    };

    // Setup visibility change handler
    if (this.config.pauseOnHidden) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    // Setup DuplexGuard listener to pause/resume STT based on TTS state
    DuplexGuard.onChange((speaking) => {
      if (speaking) {
        // TTS is speaking, pause STT to prevent echo
        if (this.recognition && this.state === 'listening') {
          console.log('[AlwaysListen] Pausing STT - TTS is speaking');
          try {
            this.recognition.stop();
          } catch (e) {
            console.warn('[AlwaysListen] Error stopping recognition for TTS:', e);
          }
        }
      } else {
        // TTS stopped, restart STT if it was enabled
        if (this.isEnabled && this.state === 'idle') {
          console.log('[AlwaysListen] Restarting STT - TTS finished');
          this.scheduleRestart(100); // Quick restart after TTS
        }
      }
    });

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Get singleton instance of AlwaysListenManager
   */
  public static getInstance(): AlwaysListenManager {
    // Check if instance is already being created to prevent race conditions
    if (AlwaysListenManager.isCreating) {
      console.warn('[AlwaysListen] ⚠️ Instance creation already in progress, returning existing or waiting...');
      // Wait a bit for creation to complete
      const maxWait = 100;
      const startTime = Date.now();
      while (AlwaysListenManager.isCreating && (Date.now() - startTime) < maxWait) {
        // Busy wait (not ideal but prevents race conditions)
      }
    }
    
    // Check for existing instance
    if (AlwaysListenManager.instance) {
      if (AlwaysListenManager.instance.instanceDisposedAt) {
        console.warn('[AlwaysListen] ⚠️ Previous instance was disposed, creating new instance...');
        AlwaysListenManager.instance = null;
        window.__alwaysListenInstance = undefined;
      } else {
        console.log('[AlwaysListen] ♻️ Returning existing singleton instance');
        return AlwaysListenManager.instance;
      }
    }
    
    // Check global window reference as backup
    if (window.__alwaysListenInstance && !window.__alwaysListenInstance.instanceDisposedAt) {
      console.log('[AlwaysListen] ♻️ Found existing instance in window, using that');
      AlwaysListenManager.instance = window.__alwaysListenInstance;
      return AlwaysListenManager.instance;
    }
    
    // Create new instance
    try {
      AlwaysListenManager.isCreating = true;
      console.log('[AlwaysListen] 🏗️ Creating new singleton instance...');
      
      // Clear any existing recognition that might be lingering
      if (typeof window !== 'undefined') {
        const existingRecognition = (window as any).__existingRecognition;
        if (existingRecognition) {
          console.warn('[AlwaysListen] 🧹 Clearing existing recognition instance...');
          try {
            existingRecognition.abort();
          } catch (e) {
            // Ignore errors
          }
          (window as any).__existingRecognition = null;
        }
      }
      
      AlwaysListenManager.instance = new AlwaysListenManager();
      return AlwaysListenManager.instance;
    } finally {
      AlwaysListenManager.isCreating = false;
    }
  }

  /**
   * Check microphone permission and availability - Using new permission system
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
    
    // Use new permission system
    const state = await checkMicPermission();
    
    this.hasPermission = state === 'granted';
    this.microphoneAvailable = state !== 'blocked';
    this.microphoneMuted = false;
    
    let errorType: string | undefined;
    if (state === 'denied') {
      errorType = 'permission-denied';
      debugBus.error('AlwaysListen', 'Microphone permission denied');
    } else if (state === 'blocked') {
      errorType = 'no-microphone';
      debugBus.error('AlwaysListen', 'No microphone device found');
    }
    
    return {
      hasPermission: this.hasPermission,
      microphoneAvailable: this.microphoneAvailable,
      microphoneMuted: this.microphoneMuted,
      errorType
    };
  }

  /**
   * Initialize continuous listening (idempotent)
   */
  async initialize(): Promise<void> {
    // Guard against concurrent operations
    if (this.operationInProgress) {
      console.warn(`[AlwaysListen] ⚠️ Operation in progress: ${this.lastOperation}, skipping initialize`);
      return;
    }
    
    // Idempotent - return if already initialized
    if (this.isInitialized) {
      console.log('[AlwaysListen] Already initialized, skipping...');
      return;
    }
    
    try {
      this.operationInProgress = true;
      this.lastOperation = 'initialize';

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

      // Create recognition instance
      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = 1;
      
      // Track recognition instance globally for cleanup
      (window as any).__existingRecognition = this.recognition;

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
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Start listening (idempotent)
   */
  async start(): Promise<void> {
    // Guard against concurrent operations
    if (this.operationInProgress) {
      console.warn(`[AlwaysListen] ⚠️ Operation in progress: ${this.lastOperation}, skipping start`);
      return;
    }
    
    try {
      this.operationInProgress = true;
      this.lastOperation = 'start';
      
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
      
      // Update global flag
      window.__alwaysListenActive = true;
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Starting', { 
          previousState: this.state 
        });
      }

      this.isEnabled = true;
      this.restartAttempts = 0;
      
      // Start recognition
      this.startRecognition();
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Stop listening with comprehensive cleanup
   */
  stop(): void {
    // Guard against concurrent operations
    if (this.operationInProgress && this.lastOperation !== 'stop') {
      console.warn(`[AlwaysListen] ⚠️ Operation in progress: ${this.lastOperation}, queuing stop`);
      // Queue a stop after a short delay
      setTimeout(() => this.stop(), 100);
      return;
    }
    
    try {
      this.operationInProgress = true;
      this.lastOperation = 'stop';
      
      console.log('[AlwaysListen] 🛑 Stopping continuous listening with full cleanup...');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Stopping', { 
          state: this.state,
          wasEnabled: this.isEnabled
        });
      }
      
      // Clear all flags
      this.isEnabled = false;
      this.isStartingRecognition = false;
      window.__alwaysListenActive = false;
      
      // Clear all timers
      this.clearTimers();
      
      // Stop and clear recognition
      if (this.recognition) {
        if (this.state === 'listening' || this.state === 'starting') {
          this.state = 'stopping';
          try {
            this.recognition.abort();
            console.log('[AlwaysListen] Recognition aborted');
          } catch (error) {
            console.warn('[AlwaysListen] Error aborting recognition:', error);
          }
        }
        
        // Remove all event handlers to prevent memory leaks
        try {
          this.recognition.onstart = null;
          this.recognition.onend = null;
          this.recognition.onresult = null;
          this.recognition.onerror = null;
          this.recognition.onspeechstart = null;
          this.recognition.onspeechend = null;
          this.recognition.onaudiostart = null;
          this.recognition.onaudioend = null;
          this.recognition.onnomatch = null;
          this.recognition.onsoundstart = null;
          this.recognition.onsoundend = null;
          console.log('[AlwaysListen] Event handlers cleared');
        } catch (e) {
          console.warn('[AlwaysListen] Error clearing event handlers:', e);
        }
      }
      
      // Reset state
      this.state = 'idle';
      this.consecutiveFailures = 0;
      this.currentRetryDelay = 500;
      this.isPausedForRecovery = false;
      this.errorMessage = '';
      this.restartAttempts = 0;
      
      console.log('[AlwaysListen] ✅ Stop complete with full cleanup');
    } finally {
      this.operationInProgress = false;
    }
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
      
      // Clear the starting flag when recognition actually starts
      this.isStartingRecognition = false;
      
      // Reset consecutive failures on successful start
      this.consecutiveFailures = 0;
      this.currentRetryDelay = 1500; // Reset to initial delay (increased from 500ms)
      this.isPausedForRecovery = false;
      this.errorMessage = '';
      
      // Mark STT as active for GlobalMonitor
      GlobalMonitor.markSTT(true);
      
      // Send heartbeat
      beat('stt', { status: 'started' });
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Recognition started');
        debugBus.info('STT', 'ready'); // Add STT ready status
      }
    };

    // Handle recognition end
    this.recognition.onend = () => {
      console.log('[AlwaysListen] 🔴 Recognition ended');
      
      // Mark STT as inactive for GlobalMonitor
      GlobalMonitor.markSTT(false);
      
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
    
    // Check if TTS is speaking - this might be echo
    if (DuplexGuard.isSpeaking()) {
      console.warn('[AlwaysListen] 🔊 STT heard something while TTS is speaking - likely echo');
      GlobalMonitor.markEcho((tag, level, msg, data) => {
        if (FEATURES.DEBUG_BUS) {
          // Use the appropriate debugBus method based on level
          switch (level) {
            case 'error':
              debugBus.error(tag, msg, data);
              break;
            case 'warn':
              debugBus.warn(tag, msg, data);
              break;
            default:
              debugBus.info(tag, msg, data);
              break;
          }
        }
      });
      // Still process but mark as potential echo
    }
    
    // Reset consecutive failures on successful recognition
    this.consecutiveFailures = 0;
    this.currentRetryDelay = 500; // Reset to initial delay
    this.lastSuccessfulRecognition = Date.now();
    this.isPausedForRecovery = false;
    this.errorMessage = '';
    
    // Send heartbeat
    beat('stt', { hasResults: true });
    
    // Reset STT health monitor timer whenever we get results
    sttHeartbeatOk();
    
    let finalTranscript = '';
    
    // Process results - ONLY emit final transcripts
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      
      if (result.isFinal) {
        // Only process final results to avoid false negatives
        finalTranscript = transcript;
        console.log('[AlwaysListen] ✅ Final:', finalTranscript);
      } else {
        // Store interim but don't emit it
        this.lastInterimTranscript = transcript;
        console.log('[AlwaysListen] 💬 Interim (not emitted):', transcript);
      }
    }
    
    // Emit ONLY final transcript
    if (finalTranscript) {
      // Mark that we heard something for GlobalMonitor
      GlobalMonitor.markHeard();
      
      // Don't emit if TTS is speaking (likely echo)
      if (!DuplexGuard.isSpeaking()) {
        this.emitTranscript(finalTranscript, true);
        
        // Wire to orchestrator for handling with wake word and speaking lock
        try {
          // Check for duplicate STT transcript
          if (isDuplicate(finalTranscript)) {
            debugBus.info('Gate', 'drop_duplicate_stt');
            console.log('[AlwaysListen] Dropping duplicate STT transcript:', finalTranscript);
            return;
          }
          
          console.log('[AlwaysListen] Sending final transcript to orchestrator:', finalTranscript);
          debugBus.info('VPrint', `final="${finalTranscript}"`);
          
          // Get wake word setting - default to true if not available
          const wakeWordEnabled = (window as any).settings?.wakeWordEnabled ?? true;
          handleUserUtterance(finalTranscript, { wakewordOn: wakeWordEnabled });
        } catch (error) {
          console.error('[AlwaysListen] Failed to send to orchestrator:', error);
          debugBus.error('AlwaysListen', 'Failed to send to orchestrator', { error });
        }
      } else {
        console.warn('[AlwaysListen] Discarding transcript during TTS playback:', finalTranscript);
      }
      this.lastInterimTranscript = '';
    }
  }

  /**
   * Handle recognition errors
   */
  private async handleError(event: SpeechRecognitionErrorEvent): Promise<void> {
    const now = Date.now();
    
    // Check if mic is unavailable but continue trying
    const micNotFound = sessionStorage.getItem('mic_device_not_found') === 'true';
    const micDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
    
    if (micNotFound || micDenied) {
      // Log warning but continue trying to engage STT
      console.warn('[AlwaysListen] Mic unavailable but continuing to attempt STT engagement');
      // Don't return early - let the system keep trying
    }
    
    // Track error rate
    if (now - this.lastErrorTime < 5000) {
      this.errorCount++;
    } else {
      this.errorCount = 1;
    }
    this.lastErrorTime = now;

    // Increment consecutive failures
    this.consecutiveFailures++;

    console.warn('[AlwaysListen] Recognition error:', event.error, event.message || '');
    console.log('[AlwaysListen] Consecutive failures:', this.consecutiveFailures, '/', this.MAX_CONSECUTIVE_FAILURES);
    
    // Store error message for UI display
    this.errorMessage = event.message || event.error;
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.warn('AlwaysListen', `Error: ${event.error}`, { 
        message: event.message,
        errorCount: this.errorCount,
        consecutiveFailures: this.consecutiveFailures,
        retryDelay: this.currentRetryDelay
      });
      debugBus.error('STT', `error: ${event.error}${event.message ? ` - ${event.message}` : ''}`);
    }

    // Check if we've hit the max consecutive failures
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      console.error('[AlwaysListen] Max consecutive failures reached. Pausing STT for manual recovery.');
      this.isPausedForRecovery = true;
      this.state = 'error';
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('AlwaysListen', 'STT paused - manual recovery needed', {
          consecutiveFailures: this.consecutiveFailures,
          errorMessage: this.errorMessage,
          lastSuccessfulRecognition: new Date(this.lastSuccessfulRecognition).toISOString()
        });
      }
      
      // Don't auto-restart when paused for recovery
      return;
    }

    switch (event.error) {
      case 'no-speech':
        // Normal timeout - restart quickly but with backoff
        console.log('[AlwaysListen] No speech detected, will restart');
        if (this.isEnabled && !this.isPausedForRecovery) {
          // Use exponential backoff for consecutive no-speech errors
          this.scheduleRestart(this.currentRetryDelay);
          this.currentRetryDelay = Math.min(this.currentRetryDelay * 1.5, this.MAX_RETRY_DELAY);
        }
        break;

      case 'not-allowed':
        // Permission denied - STOP IMMEDIATELY, no retries
        console.error('[AlwaysListen] Permission error detected - STOPPING');
        
        // Import permission checking function
        const { isPermissionDenied: checkIfDenied } = await import('@/lib/permissions/microphone');
        
        // Mark that permission was denied
        this.hasPermission = false;
        this.state = 'error';
        this.isPausedForRecovery = true; // Prevent auto-restart
        this.errorMessage = 'Microphone permission denied - please enable in browser settings';
        
        // Check actual permission state
        const permissionStatus = await this.checkMicrophonePermission();
        
        if (!permissionStatus.hasPermission || checkIfDenied()) {
          console.error('[AlwaysListen] Confirmed: Microphone permission denied - will NOT retry');
          
          if (FEATURES.DEBUG_BUS) {
            debugBus.error('AlwaysListen', 'Permission permanently denied - stopping all retries', {
              ...permissionStatus,
              action: 'User must grant permission in browser settings',
              willRetry: false
            });
          }
          
          // DO NOT schedule restart or monitor - just stop
          this.isEnabled = false; // Disable to prevent any restarts
          
          // Clear any existing timers
          if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
          }
          
          // Send error heartbeat
          beat('stt', { status: 'error', hasPermission: false, reason: 'permission_denied' });
        } else {
          // Permission is actually granted, might be a transient error
          console.log('[AlwaysListen] Permission check passed, likely transient error');
          if (this.isEnabled && !this.isPausedForRecovery) {
            this.scheduleRestart(2000); // Longer delay for safety
          }
        }
        break;

      case 'audio-capture':
        // Audio capture failed - could be permission denied, muted mic, or no device
        console.error('[AlwaysListen] Audio capture failed, checking status...');
        
        // Import permission checking function
        const { isPermissionDenied: isDenied } = await import('@/lib/permissions/microphone');
        
        // Check if permission was denied first
        if (isDenied()) {
          console.error('[AlwaysListen] Audio-capture error due to permission denial - STOPPING');
          this.hasPermission = false;
          this.state = 'error';
          this.isPausedForRecovery = true; // Prevent auto-restart
          this.isEnabled = false; // Disable completely
          this.errorMessage = 'Microphone permission denied - please enable in browser settings';
          
          if (FEATURES.DEBUG_BUS) {
            debugBus.error('AlwaysListen', 'Audio-capture failed due to permission denial', {
              action: 'User must grant permission in browser settings',
              willRetry: false
            });
          }
          
          // Clear any existing timers
          if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
          }
          
          // Send error heartbeat
          beat('stt', { status: 'error', hasPermission: false, reason: 'permission_denied' });
          break; // Exit early, no recovery
        }
        
        // Increment consecutive failures for audio-capture errors
        this.consecutiveFailures++;
        console.log(`[AlwaysListen] Audio-capture error count: ${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES}`);
        
        // Check if we need to pause for recovery after too many failures
        if (this.consecutiveFailures >= 5) {
          console.warn('[AlwaysListen] Too many audio-capture failures, entering recovery pause (30 seconds)');
          this.isPausedForRecovery = true;
          this.errorMessage = 'Voice system paused for recovery - will retry in 30 seconds';
          
          // Only schedule recovery if permission is not denied
          if (!isDenied()) {
            setTimeout(() => {
              console.log('[AlwaysListen] Recovery period complete, attempting to restart...');
              this.isPausedForRecovery = false;
              this.consecutiveFailures = 0;
              this.currentRetryDelay = 500; // Reset delay
              if (this.isEnabled) {
                this.start();
              }
            }, 30000); // 30 second recovery period
          }
          
          this.state = 'error';
          break; // Exit early, don't schedule immediate restart
        }
        
        // Check if it's because the source is muted
        if (event.message && event.message.includes('muted')) {
          console.warn('[AlwaysListen] 🔇 Microphone appears to be muted');
          this.microphoneMuted = true;
          this.errorMessage = 'Microphone is muted - please unmute to use voice commands';
          
          // Check actual permission/device state
          const micStatus = await this.checkMicrophonePermission();
          
          if (!micStatus.hasPermission) {
            console.error('[AlwaysListen] No microphone permission');
            this.hasPermission = false;
            this.errorMessage = 'Microphone permission denied';
            this.startPermissionMonitoring();
          } else if (micStatus.microphoneMuted) {
            console.warn('[AlwaysListen] 🔇 Microphone is muted at browser/OS level');
            if (FEATURES.DEBUG_BUS) {
              debugBus.warn('AlwaysListen', 'Microphone muted - waiting 5s before retry', { 
                message: 'Please unmute your microphone to use voice commands',
                nextRetryIn: this.MUTED_RETRY_DELAY
              });
            }
            // Start monitoring for when mic becomes unmuted
            this.startMicrophoneMonitoring();
            
            // Use longer delay for muted microphone (5 seconds)
            if (this.isEnabled && !this.isPausedForRecovery) {
              this.scheduleRestart(this.MUTED_RETRY_DELAY);
            }
          } else if (!micStatus.microphoneAvailable) {
            console.error('[AlwaysListen] No microphone device available');
            this.errorMessage = 'No microphone detected - please connect a microphone';
            if (FEATURES.DEBUG_BUS) {
              debugBus.error('AlwaysListen', 'No microphone device', { 
                message: 'Please connect a microphone to use voice commands'
              });
            }
            // Start monitoring for when mic becomes available
            this.startMicrophoneMonitoring();
            
            // Use exponential backoff with less aggressive growth
            if (this.isEnabled && !this.isPausedForRecovery) {
              const nextDelay = Math.min(this.currentRetryDelay * 1.5, this.MAX_RETRY_DELAY);
              console.log(`[AlwaysListen] Will retry in ${nextDelay}ms`);
              this.scheduleRestart(nextDelay);
              this.currentRetryDelay = nextDelay;
            }
          }
        } else {
          // Other audio capture error - use exponential backoff with less aggressive growth
          if (this.isEnabled && !this.isPausedForRecovery) {
            const nextDelay = Math.min(this.currentRetryDelay * 1.5, this.MAX_RETRY_DELAY);
            console.log(`[AlwaysListen] Will retry in ${nextDelay}ms`);
            this.scheduleRestart(nextDelay);
            this.currentRetryDelay = nextDelay;
          }
        }
        
        this.state = 'error';
        break;

      case 'network':
        // Network error - retry
        console.error('[AlwaysListen] Network error');
        if (this.isEnabled) {
          this.scheduleRestart(1000);
        }
        break;

      case 'aborted':
        // Recognition aborted - restart if enabled with longer delay
        console.log('[AlwaysListen] Recognition aborted');
        if (this.isEnabled && !this.isPausedForRecovery) {
          // Use longer delay for aborted errors to prevent rapid restarts
          this.scheduleRestart(2000); // Increased from 200ms to 2000ms
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
    
    // Check if already starting to prevent concurrent starts
    if (this.isStartingRecognition) {
      console.log('[AlwaysListen] Already starting recognition, skipping concurrent start');
      return;
    }
    
    // Check current state
    if (this.state === 'listening' || this.state === 'starting') {
      console.log('[AlwaysListen] Already starting/listening, skipping start');
      return;
    }
    
    // Set the global flag to prevent concurrent starts
    this.isStartingRecognition = true;
    
    // Try to ensure mic is ready (iOS-safe bootstrap)
    try {
      console.log('[AlwaysListen] Ensuring mic is ready...');
      const micStream = await ensureMicReady();
      console.log('[AlwaysListen] Mic ready, got stream');
      // Store the stream reference
      stream = micStream;
      this.hasPermission = true;
      this.microphoneAvailable = true;
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Mic ready via ensureMicReady in startRecognition');
      }
    } catch (error) {
      console.warn('[AlwaysListen] Could not ensure mic ready, continuing anyway:', error);
      this.hasPermission = false;
      
      // Clear the flag on mic ready error too
      this.isStartingRecognition = false;
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('AlwaysListen', 'Starting without mic ready', { error: String(error) });
      }
      
      // Start monitoring for permission but don't return
      this.startPermissionMonitoring();
    }
    
    // Check microphone permission status
    const permissionStatus = await this.checkMicrophonePermission();
    
    if (permissionStatus.microphoneMuted) {
      console.warn('[AlwaysListen] Warning: Microphone is muted, continuing anyway');
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('AlwaysListen', 'Starting with muted microphone', permissionStatus);
      }
    }
    
    if (!permissionStatus.microphoneAvailable) {
      console.warn('[AlwaysListen] No microphone available, but attempting to engage STT anyway');
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.warn('AlwaysListen', 'Attempting STT without microphone', permissionStatus);
      }
      
      // Start monitoring for microphone but don't return
      this.startMicrophoneMonitoring();
    }
    
    this.state = 'starting';
    
    try {
      this.recognition.start();
      console.log('[AlwaysListen] Recognition start requested');
      // Clear the flag after successful start request
      this.isStartingRecognition = false;
    } catch (error: any) {
      console.error('[AlwaysListen] Failed to start recognition:', error);
      
      // Always clear the flag on error
      this.isStartingRecognition = false;
      
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
        this.scheduleRestart(2000); // Increased from 500ms to 2000ms to prevent rapid restarts
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
    // Check mic status but continue trying
    const micNotFound = sessionStorage.getItem('mic_device_not_found') === 'true';
    const micDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
    
    if (micNotFound || micDenied) {
      console.warn('[AlwaysListen] Mic unavailable, but still scheduling restart to keep trying');
      // Don't return - continue with restart schedule
    }
    
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
   * Manual recovery - force restart the STT system
   * This clears error states and resets retry delays
   */
  async forceRestart(): Promise<void> {
    // Guard against concurrent operations
    if (this.operationInProgress) {
      console.warn(`[AlwaysListen] ⚠️ Operation in progress: ${this.lastOperation}, queuing force restart`);
      setTimeout(() => this.forceRestart(), 200);
      return;
    }
    
    try {
      this.operationInProgress = true;
      this.lastOperation = 'forceRestart';
      
      console.log('[AlwaysListen] 🔧 Force restart requested - cleaning up and restarting singleton');
      
      // Reset all error states
      this.consecutiveFailures = 0;
      this.currentRetryDelay = 500;
      this.isPausedForRecovery = false;
      this.errorMessage = '';
      this.restartAttempts = 0;
      this.errorCount = 0;
      
      // Clear any pending restart timer
      this.clearTimers();
      
      // Stop current recognition if active
      if (this.recognition && (this.state === 'listening' || this.state === 'starting')) {
        try {
          this.recognition.abort();
          console.log('[AlwaysListen] Existing recognition aborted');
        } catch (error) {
          console.warn('[AlwaysListen] Error aborting during force restart:', error);
        }
      }
      
      // Update state
      this.state = 'idle';
      
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('AlwaysListen', 'Force restart initiated', {
          wasEnabled: this.isEnabled,
          hadPermission: this.hasPermission,
          instanceAge: Date.now() - this.instanceCreatedAt
        });
      }
      
      // Re-enable if it was enabled
      if (this.isEnabled) {
        // Small delay to ensure clean restart
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.startRecognition();
      }
      
      console.log('[AlwaysListen] ✅ Force restart complete');
    } finally {
      this.operationInProgress = false;
    }
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
    consecutiveFailures: number;
    isPausedForRecovery: boolean;
    errorMessage: string;
    currentRetryDelay: number;
  } {
    return {
      isEnabled: this.isEnabled,
      isListening: this.state === 'listening',
      hasPermission: this.hasPermission,
      state: this.state,
      restartAttempts: this.restartAttempts,
      errorCount: this.errorCount,
      microphoneAvailable: this.microphoneAvailable,
      microphoneMuted: this.microphoneMuted,
      consecutiveFailures: this.consecutiveFailures,
      isPausedForRecovery: this.isPausedForRecovery,
      errorMessage: this.errorMessage,
      currentRetryDelay: this.currentRetryDelay
    };
  }

  /**
   * Check if AlwaysListen is currently active
   */
  isActive(): boolean {
    return this.isEnabled && this.state === 'listening' && !this.isPausedForRecovery;
  }

  /**
   * Comprehensive cleanup and disposal
   */
  destroy(): void {
    console.log('[AlwaysListen] 🗑️ Destroying singleton instance...');
    
    // Stop listening first
    this.stop();
    
    // Clear health monitoring
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    
    // Remove event listeners
    if (this.config.pauseOnHidden) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    
    // Clear recognition completely
    if (this.recognition) {
      try {
        // Ensure it's stopped
        this.recognition.abort();
      } catch (e) {
        // Ignore errors
      }
      
      // Clear global reference
      if ((window as any).__existingRecognition === this.recognition) {
        (window as any).__existingRecognition = null;
      }
      
      this.recognition = null;
    }
    
    // Mark instance as disposed
    this.instanceDisposedAt = Date.now();
    this.isInitialized = false;
    
    // Clear global window flags
    if (window.__alwaysListenInstance === this) {
      window.__alwaysListenInstance = undefined;
      window.__alwaysListenActive = false;
      window.__alwaysListenDisposedAt = this.instanceDisposedAt;
    }
    
    // Clear static instance reference
    if (AlwaysListenManager.instance === this) {
      AlwaysListenManager.instance = null;
    }
    
    const lifetime = this.instanceDisposedAt - this.instanceCreatedAt;
    console.log(`[AlwaysListen] ✅ Singleton disposed after ${lifetime}ms lifetime`);
    
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('AlwaysListen', 'Singleton destroyed', {
        lifetime,
        createdAt: new Date(this.instanceCreatedAt).toISOString(),
        disposedAt: new Date(this.instanceDisposedAt).toISOString()
      });
    }
  }
}

// Export singleton getter
const alwaysListen = AlwaysListenManager.getInstance();

// Expose to window for debugging in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__ALWAYS_LISTEN__ = alwaysListen;
  (window as any).__ALWAYS_LISTEN_MANAGER__ = AlwaysListenManager;
  console.log('[AlwaysListen] 🔍 Debug access available: window.__ALWAYS_LISTEN__ and window.__ALWAYS_LISTEN_MANAGER__');
}

export { alwaysListen, AlwaysListenManager };
export type { AlwaysListenConfig, AlwaysCfg };