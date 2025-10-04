/**
 * System Configuration Module
 * =========================
 * Centralized configuration for all system parameters.
 * This module consolidates all hardcoded values that were previously scattered
 * throughout the codebase into a single, maintainable configuration system.
 * 
 * @module config/system
 * @description Single source of truth for all system configuration values
 */

// ============================================================================
// VOICE CONFIGURATION
// ============================================================================

/**
 * Speech-to-Text (STT) configuration
 */
export const STT_CONFIG = {
  /** Language for speech recognition */
  language: 'en-US',
  
  /** Enable continuous recognition mode */
  continuous: true,
  
  /** Enable interim results */
  interimResults: true,
  
  /** Maximum alternatives to return */
  maxAlternatives: 1,
  
  /** Auto-restart delay after recognition ends (ms) */
  autoRestartDelay: 500,
  
  /** Maximum restart attempts before giving up */
  maxRestartAttempts: 5,
  
  /** No speech timeout before restarting (ms) */
  noSpeechTimeout: 10000,
  
  /** Silence detection timeout (ms) */
  silenceTimeout: 2000,
} as const;

/**
 * Text-to-Speech (TTS) configuration
 */
export const TTS_CONFIG = {
  /** Default voice profile settings */
  defaultProfile: {
    id: 'jarvis',
    name: 'Jarvis',
    type: 'neural' as const,
    pitch: 0.9,
    rate: 1.0,
    volume: 0.9,
    locale: 'en-GB',
    voice: 'Google UK English Male',
  },
  
  /** Voice parameter ranges */
  ranges: {
    pitch: { min: 0, max: 2 },
    rate: { min: 0.1, max: 10 },
    volume: { min: 0, max: 1 },
  },
  
  /** Maximum speech queue size */
  maxQueueSize: 10,
  
  /** Cooldown after speaking ends (ms) */
  speakingCooldown: 300,
  
  /** Maximum attempts to load voices */
  maxVoiceLoadAttempts: 50,
  
  /** Voice load retry delay (ms) */
  voiceLoadRetryDelay: 200,
} as const;

/**
 * Wake word detection configuration
 */
export const WAKE_WORD_CONFIG = {
  /** Primary wake word */
  primary: 'lolo',
  
  /** Accepted wake word variations */
  variations: [
    'lolo',
    'hey lolo',
    'ok lolo',
    'hi lolo',
    'yo lolo'
  ],
  
  /** Cooldown after wake word detection (ms) */
  cooldownDuration: 2000,
  
  /** Active window duration after wake word (ms) */
  windowDuration: 10000,
} as const;

// ============================================================================
// AUDIO PROCESSING CONFIGURATION
// ============================================================================

/**
 * Voice Activity Detection (VAD) configuration
 */
export const VAD_CONFIG = {
  /** Minimum decibel level to consider as speech */
  minDb: -45,
  
  /** Minimum duration to consider as valid speech (ms) */
  minDuration: 280,
  
  /** Debounce time after speech ends (ms) */
  debounceMs: 500,
  
  /** Audio analysis FFT size */
  fftSize: 2048,
} as const;

/**
 * Audio analysis configuration
 */
export const AUDIO_CONFIG = {
  /** FFT size for frequency analysis */
  fftSize: 2048,
  
  /** Window size for pitch estimation (ms) */
  windowSize: 25,
  
  /** Hop size as fraction of window size */
  hopSizeFraction: 0.5,
  
  /** Valid pitch range for speech (Hz) */
  pitchRange: { min: 50, max: 500 },
  
  /** Default pitch values when estimation fails */
  defaultPitch: { mean: 150, std: 20 },
  
  /** MFCC parameters for voice analysis */
  mfcc: {
    bins: 26,
    dimensions: 13,
  },
} as const;

// ============================================================================
// HEALTH MONITORING CONFIGURATION
// ============================================================================

/**
 * Health monitoring configuration
 */
export const HEALTH_CONFIG = {
  /** Health check interval (ms) */
  checkInterval: 3000,
  
  /** Minimum interval between recovery attempts (ms) */
  minRecoveryInterval: 30000,
  
  /** Maximum consecutive stuck checks before manual recovery */
  maxStuckChecks: 3,
  
  /** Component heartbeat thresholds (ms) */
  heartbeatThresholds: {
    stt: 15000,
    tts: 20000,
    gate: 25000,
    orchestrator: 30000,
  },
  
  /** Maximum retry delay for exponential backoff (ms) */
  maxRetryDelay: 10000,
  
  /** Maximum consecutive failures before giving up */
  maxConsecutiveFailures: 10,
  
  /** Retry delay when mic is muted (ms) */
  mutedRetryDelay: 5000,
} as const;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

/**
 * UI animation and timing configuration
 */
export const UI_CONFIG = {
  /** Animation durations */
  animations: {
    /** Default transition duration (ms) */
    defaultTransition: 300,
    
    /** Hover effect duration (ms) */
    hoverTransition: 200,
    
    /** Fade animation duration (ms) */
    fadeTransition: 150,
    
    /** Slide animation duration (ms) */
    slideTransition: 300,
    
    /** Pulse animation interval (ms) */
    pulseInterval: 100,
  },
  
  /** Z-index hierarchy */
  zIndex: {
    /** Base UI elements */
    base: 1,
    
    /** Dropdown menus and selects */
    dropdown: 50,
    
    /** Sticky elements */
    sticky: 100,
    
    /** Modal backdrop */
    modalBackdrop: 500,
    
    /** Modal content */
    modal: 1000,
    
    /** Chat input bar container */
    chatBar: 9999,
    
    /** Chat toggle button */
    chatToggle: 10000,
    
    /** Toast notifications */
    toast: 10001,
  },
  
  /** Responsive breakpoints */
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
  },
  
  /** Default sizes */
  sizes: {
    headerHeight: 48,
    headerHeightMobile: 44,
    hologramSize: 120,
    hologramCoreSizeFactor: 0.4,
  },
} as const;

/**
 * Hologram visualization configuration
 */
export const HOLOGRAM_CONFIG = {
  /** Number of particles in visualization */
  particleCount: 100,
  
  /** Animation speeds */
  animation: {
    corePulse: 2000,
    ringSpinA: 4000,
    ringSpinB: 3000,
    ringSpinC: 6000,
    particleFloat: 8000,
  },
  
  /** Size factors */
  sizes: {
    coreRadius: 0.06,
    corePulseRange: 0.015,
    bubbleRadiusFactor: 1.15,
  },
  
  /** Edge bounce margin (pixels) */
  edgeMargin: 50,
} as const;

// ============================================================================
// NETWORK AND API CONFIGURATION
// ============================================================================

/**
 * Network request configuration
 */
export const NETWORK_CONFIG = {
  /** Request timeout defaults (ms) */
  timeouts: {
    default: 30000,
    health: 5000,
    nlp: 60000,
    diagnostics: 10000,
  },
  
  /** Polling intervals (ms) */
  polling: {
    health: 6000,
    metrics: 3000,
    diagnostics: 30000,
  },
  
  /** Retry configuration */
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  },
} as const;

// ============================================================================
// DEBUG AND DIAGNOSTICS CONFIGURATION
// ============================================================================

/**
 * Debug and diagnostics configuration
 */
export const DEBUG_CONFIG = {
  /** Maximum events to keep in debug bus */
  maxEvents: 400,
  
  /** Diagnostic runner interval (ms) */
  diagRunnerInterval: 4000,
  
  /** Diagnostic check timeout (ms) */
  diagCheckTimeout: 800,
  
  /** Session tracking keys */
  sessionKeys: {
    ttsUtterances: 'ttsClientUtterances',
    profilesLearned: 'profilesLearned',
    checkpointsMade: 'checkpointsMade',
  },
} as const;

// ============================================================================
// PERMISSION CONFIGURATION
// ============================================================================

/**
 * Permission handling configuration
 */
export const PERMISSION_CONFIG = {
  /** Microphone getUserMedia constraints */
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  
  /** Permission check retry interval (ms) */
  checkInterval: 5000,
  
  /** Maximum permission check attempts */
  maxCheckAttempts: 3,
} as const;

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * Local storage and session storage keys
 */
export const STORAGE_KEYS = {
  /** Local storage keys */
  local: {
    wakeWord: 'wake_word',
    uiMode: 'lolo.uiMode',
    chatBarVisible: 'chango-chat-bar-visible',
    voiceSecurity: 'chango.voice.security.v1',
  },
  
  /** Session storage keys */
  session: {
    micPermissionGranted: 'mic_permission_granted',
    micPermissionDenied: 'mic_permission_denied',
    micDeviceNotFound: 'mic_device_not_found',
  },
} as const;

// ============================================================================
// FEATURE FLAGS (moved from separate file for consolidation)
// ============================================================================

/**
 * Feature flags for enabling/disabling functionality
 */
export const FEATURES = {
  // UI Features
  HANDS_FREE_UI: false,
  WAKE_WORD: true,
  ALWAYS_LISTENING: true,
  ALWAYS_LISTEN_DEFAULT: true,
  ANSWER_ONLY_WHEN_ASKED: true,
  AnswerOnlyWhenAddressed: true,
  COMPACT_HEADER: true,
  GUARDED_CANCEL: true,
  
  // Voice Features
  TTS_ENABLED: true,
  STT_ENABLED: true,
  LOCAL_NEURAL_TTS: true,
  VOICE_PROFILES: true,
  
  // UI Components
  SHOW_HEADER_BAR: true,
  SHOW_ASK_BAR: true,
  SHOW_STATUS_DOCK: true,
  SHOW_HOLOGRAM: true,
  UI_MODE_TOGGLE: true,
  LEGACY_HEADER: false,
  
  // Debug Features
  DEBUG_LOGS: false,
  SHOW_DIAGNOSTICS: false,
  DEBUG_BUS: true,
  DEBUG_OVERLAY: true,
  AUTO_HEAL: true,
  
  // Behavior
  AUTO_RESTART_ON_ERROR: true,
  PAUSE_ON_HIDDEN: true,
  
  // Integration
  USE_VOICE_BUS: true,
  USE_CONVERSATION_ENGINE: true,
  
  // Experimental
  EXPERIMENTAL_FEATURES: false,
  VOICE_ACTIVITY_DETECTION: false,
  ACCENT_EMULATION: false,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** System configuration type */
export type SystemConfig = typeof SYSTEM_CONFIG;

/** Feature flags type */
export type FeatureFlags = typeof FEATURES;

// ============================================================================
// COMPOSITE CONFIGURATION EXPORT
// ============================================================================

/**
 * Complete system configuration object
 */
export const SYSTEM_CONFIG = {
  stt: STT_CONFIG,
  tts: TTS_CONFIG,
  wakeWord: WAKE_WORD_CONFIG,
  vad: VAD_CONFIG,
  audio: AUDIO_CONFIG,
  health: HEALTH_CONFIG,
  ui: UI_CONFIG,
  hologram: HOLOGRAM_CONFIG,
  network: NETWORK_CONFIG,
  debug: DEBUG_CONFIG,
  permissions: PERMISSION_CONFIG,
  storage: STORAGE_KEYS,
  features: FEATURES,
} as const;

// Default export for convenience
export default SYSTEM_CONFIG;