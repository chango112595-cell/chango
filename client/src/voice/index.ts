/**
 * Voice System Module Index
 * =========================
 * 
 * @module voice
 * @description Central export point for all voice-related functionality.
 * 
 * This index file provides a clean interface to the voice system,
 * hiding internal implementation details and exposing only the
 * necessary APIs for external consumption.
 * 
 * **Module Architecture:**
 * ```
 * voice/
 * ├── stt.ts           - Speech-to-text recognition
 * ├── wakeWord.ts      - Wake word detection
 * ├── voiceBus.ts      - Event bus for voice events
 * ├── voiceController.ts - Voice state management
 * ├── always_listen.ts - Continuous listening management
 * ├── tts/             - Text-to-speech subsystem
 * │   ├── interfaces.ts - TTS type definitions
 * │   ├── orchestrator.ts - TTS provider management
 * │   └── providers/    - TTS provider implementations
 * └── security/        - Voice security features
 *     └── voiceprint.ts - Voice authentication
 * ```
 */

// ===========================================================================
// SPEECH-TO-TEXT EXPORTS
// ===========================================================================

export {
  // Main functions
  startSTT,
  stopSTT,
  isSTTActive,
  
  // Types
  type STTOpts,
} from './stt';

// ===========================================================================
// WAKE WORD DETECTION EXPORTS
// ===========================================================================

export {
  // Singleton instance
  wakeWordDetector,
  
  // Types
  type WakeWordConfig,
} from './wakeWord';

// ===========================================================================
// VOICE BUS EXPORTS
// ===========================================================================

export {
  // Singleton instance
  voiceBus,
  
  // Types
  type VoiceEvent,
  type VoiceEventType,
} from './voiceBus';

// ===========================================================================
// VOICE CONTROLLER EXPORTS
// ===========================================================================

export {
  // Singleton instance (named export)
  Voice,
  
  // Default export (the main controller)
  voiceController,
} from './voiceController';

// ===========================================================================
// ALWAYS LISTEN EXPORTS
// ===========================================================================

export {
  // Manager instance
  alwaysListen,
  
  // Functions
  startAlwaysListenNew,
  stopAlwaysListenNew,
  ensureAudioUnlocked,
  
  // Types
  type AlwaysListenConfig,
  type AlwaysCfg,
} from './always_listen';

// ===========================================================================
// TEXT-TO-SPEECH EXPORTS
// ===========================================================================

export {
  // Orchestrator instance
  voiceOrchestrator,
  
  // Provider class
  VoiceOrchestrator,
} from './tts/orchestrator';

export {
  // Types
  type VoiceProfile,
  type TTSSpeakOptions,
  type TTSProvider,
} from './tts/interfaces';

export {
  // Local neural provider
  LocalNeuralProvider,
} from './tts/providers/localNeural';

// ===========================================================================
// VOICE SECURITY EXPORTS
// ===========================================================================

export {
  // Engine instance
  VoiceprintEngine,
  
  // Types
  type Voiceprint,
} from './security/voiceprint';

// ===========================================================================
// CONVENIENCE EXPORTS
// ===========================================================================

/**
 * Check if voice features are available in the current environment
 */
export function isVoiceAvailable(): boolean {
  const hasSpeechRecognition = 'SpeechRecognition' in window || 
                               'webkitSpeechRecognition' in window;
  const hasSpeechSynthesis = 'speechSynthesis' in window;
  const hasGetUserMedia = !!(navigator.mediaDevices && 
                             navigator.mediaDevices.getUserMedia);
  
  return hasSpeechRecognition && hasSpeechSynthesis && hasGetUserMedia;
}

/**
 * Get voice system capabilities
 */
export function getVoiceCapabilities() {
  return {
    stt: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    tts: 'speechSynthesis' in window,
    microphone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
    secureContext: window.isSecureContext === true,
  };
}