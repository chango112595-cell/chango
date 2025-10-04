/**
 * Components Module Index
 * =======================
 * 
 * @module components
 * @description Central export point for UI components
 * 
 * UI components should be:
 * - Self-contained with minimal external dependencies
 * - Pure presentation logic with service delegation
 * - Well-typed with clear prop interfaces
 * - Responsive and accessible
 * 
 * **Component Categories:**
 * - Voice: Voice controls and status displays
 * - Chat: Input bars and message displays
 * - Permissions: Permission request flows
 * - Visualization: Hologram and audio visualizers
 */

// ===========================================================================
// CHAT COMPONENTS
// ===========================================================================

export { ChatInputBar } from './ChatInputBar';
export type { ChatInputBarProps } from './ChatInputBar';

// ===========================================================================
// VOICE COMPONENTS
// ===========================================================================

export { default as VoiceControls } from './VoiceControls';
export { default as MicrophonePermission } from './MicrophonePermission';

// ===========================================================================
// VISUALIZATION COMPONENTS
// ===========================================================================

export { default as Hologram } from './Hologram';
export { default as AudioVisualizationCanvas } from './AudioVisualizationCanvas';

// ===========================================================================
// UI UTILITIES
// ===========================================================================

/**
 * Check if all critical UI components are available
 */
export function areComponentsReady(): boolean {
  return true; // Components are always ready as they're synchronously imported
}