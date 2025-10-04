/**
 * Hooks Index
 * ===========
 * 
 * @module hooks
 * @description Central export point for React hooks.
 * 
 * Custom hooks encapsulate stateful logic and side effects
 * for use across React components. They should be pure,
 * reusable, and well-documented.
 * 
 * **Hook Categories:**
 * - Voice: Audio recording, synthesis, VAD
 * - UI: Mobile detection, UI mode management
 * - Integration: Toast notifications
 */

// ===========================================================================
// VOICE HOOKS
// ===========================================================================

export { useAlwaysListen } from './useAlwaysListen';
export { useAudioRecording } from './useAudioRecording';
export { useVAD } from './useVAD';
export { useVoiceprint } from './useVoiceprint';
export { useVoiceSynthesis } from './useVoiceSynthesis';
export { useVoiceSynthesisWithExport } from './useVoiceSynthesisWithExport';
export { useWakeWord } from './useWakeWord';
export { useHologram } from './useHologram';

// ===========================================================================
// UI HOOKS
// ===========================================================================

export { useIsMobile } from './use-mobile';
export { useUIMode } from './useUIMode';

// ===========================================================================
// INTEGRATION HOOKS
// ===========================================================================

export { useToast } from './use-toast';