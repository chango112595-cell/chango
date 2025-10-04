/**
 * Core System Module Index
 * ========================
 * 
 * @module core
 * @description Central export point for core system functionality.
 * 
 * The core module provides fundamental services that other modules
 * depend on, including permissions, gating, event orchestration,
 * and cross-cutting concerns.
 * 
 * **Module Architecture:**
 * ```
 * core/
 * ├── gate.ts         - Voice input gating and filtering
 * ├── orchestrator.ts - Message routing and orchestration
 * ├── permissions.ts  - Microphone permission management
 * └── voice-bus.ts    - Core event bus for voice events
 * ```
 */

// ===========================================================================
// VOICE GATE EXPORTS
// ===========================================================================

export {
  // Singleton instance
  voiceGate,
  
  // Class export
  VoiceGate,
  
  // Convenience functions
  openGate,
  closeGate,
  isGateOpen,
} from './gate';

// ===========================================================================
// ORCHESTRATOR EXPORTS
// ===========================================================================

export {
  // Singleton instance
  orchestrator,
  
  // Class export
  VoiceOrchestrator,
  
  // Convenience functions
  routeMessage,
  handleUserGesture,
  getOrchestratorStatus,
  
  // Types
  type MessageInput,
  type RouteDecision,
} from './orchestrator';

// ===========================================================================
// PERMISSIONS EXPORTS
// ===========================================================================

export {
  // Main functions
  queryMicPermission,
  ensureMicPermission,
  isSecureContext,
  isGetUserMediaAvailable,
  getPermissionDiagnostics,
  
  // Types
  type PermissionStatus,
} from './permissions';

// ===========================================================================
// VOICE BUS EXPORTS (Core variant)
// ===========================================================================

export {
  // Singleton instance
  voiceBus,
  
  // Types
  type VoiceEvent,
  type VoiceEventType,
} from './voice-bus';

// ===========================================================================
// SYSTEM STATUS EXPORTS
// ===========================================================================

/**
 * Get overall system readiness status
 */
export function getSystemStatus() {
  const { voiceGate } = require('./gate');
  const { orchestrator } = require('./orchestrator');
  const { queryMicPermission } = require('./permissions');
  
  return {
    gate: voiceGate.getStatus(),
    orchestrator: orchestrator.getStatus(),
    permissions: queryMicPermission(),
    secureContext: window.isSecureContext === true,
  };
}

/**
 * Check if the core system is ready for voice interaction
 */
export async function isCoreReady(): Promise<boolean> {
  const { voiceGate } = require('./gate');
  const permission = await require('./permissions').queryMicPermission();
  
  return voiceGate.isGateOpen() && permission.granted;
}