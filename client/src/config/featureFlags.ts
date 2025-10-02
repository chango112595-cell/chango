/**
 * Feature Flags Configuration
 * Controls which features are enabled/disabled in the application
 */

export const FEATURES = {
  // UI Features
  HANDS_FREE_UI: false,         // Hide the hands-free UI card entirely
  WAKE_WORD: true,              // Enable wake word detection (e.g., "Hey Lolo")
  ALWAYS_LISTENING: true,       // Always listen for voice input
  ALWAYS_LISTEN_DEFAULT: true,  // Start listening by default on app load
  ANSWER_ONLY_WHEN_ASKED: true, // Only respond to questions (not statements)
  AnswerOnlyWhenAddressed: true, // Only respond when directly addressed with "Lolo" or via Ask bar
  COMPACT_HEADER: true,         // Use compact header UI
  GUARDED_CANCEL: true,         // Require confirmation for cancel actions
  
  // Voice Features  
  TTS_ENABLED: true,            // Enable text-to-speech
  STT_ENABLED: true,            // Enable speech-to-text
  LOCAL_NEURAL_TTS: true,       // Use browser's native TTS (not cloud)
  VOICE_PROFILES: true,         // Enable voice profile selection
  
  // UI Components
  SHOW_HEADER_BAR: true,        // Show the futuristic header bar
  SHOW_ASK_BAR: true,           // Show the text input ask bar
  SHOW_STATUS_DOCK: true,       // Show the status dock
  SHOW_HOLOGRAM: true,          // Show the hologram/sphere
  UI_MODE_TOGGLE: true,          // Enable toggling between header and sphere UI modes
  
  // Debug Features
  DEBUG_LOGS: false,            // Enable verbose console logging
  SHOW_DIAGNOSTICS: false,      // Show system diagnostics panel
  DEBUG_BUS: true,              // Enable debug event bus system
  DEBUG_OVERLAY: true,          // Show debug overlay with health status
  AUTO_HEAL: true,              // Enable auto-heal functionality
  
  // Behavior
  AUTO_RESTART_ON_ERROR: true,  // Auto-restart voice services on error
  PAUSE_ON_HIDDEN: true,        // Pause listening when tab is hidden
  SILENCE_TIMEOUT: 2000,        // MS of silence before restarting recognition
  
  // Voice Settings
  DEFAULT_VOICE_PROFILE: 'jarvis', // Default voice profile to use
  DEFAULT_LOCALE: 'en-US',         // Default locale for speech
  DEFAULT_RATE: 1.0,               // Default speech rate
  DEFAULT_PITCH: 0.9,              // Default speech pitch  
  DEFAULT_VOLUME: 0.9,             // Default speech volume
  
  // Integration
  USE_VOICE_BUS: true,          // Use the event-driven voice bus
  USE_CONVERSATION_ENGINE: true, // Use the conversation engine for routing
  
  // Experimental
  EXPERIMENTAL_FEATURES: false,  // Enable experimental features
  VOICE_ACTIVITY_DETECTION: false, // Use VAD for better speech detection
  ACCENT_EMULATION: false,       // Enable accent emulation features
  
  // Performance
  MAX_QUEUE_SIZE: 10,           // Maximum items in speech queue
  DEBOUNCE_MS: 300,             // Debounce time for rapid inputs
  MAX_TRANSCRIPT_LENGTH: 500,   // Maximum transcript length in characters
};

/**
 * Helper function to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] === true;
}

/**
 * Helper function to get numeric feature value
 */
export function getFeatureValue(feature: keyof typeof FEATURES): any {
  return FEATURES[feature];
}

/**
 * Export individual flags for convenience
 */
export const {
  HANDS_FREE_UI,
  WAKE_WORD,
  ALWAYS_LISTENING,
  ALWAYS_LISTEN_DEFAULT,
  ANSWER_ONLY_WHEN_ASKED,
  TTS_ENABLED,
  STT_ENABLED,
  LOCAL_NEURAL_TTS,
  SHOW_HEADER_BAR,
  SHOW_ASK_BAR,
  SHOW_STATUS_DOCK,
  DEBUG_LOGS,
} = FEATURES;