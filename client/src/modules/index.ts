/**
 * Modules Index
 * =============
 * 
 * @module modules
 * @description Central export point for application modules.
 * 
 * Modules encapsulate specific feature areas of the application.
 * Each module should be self-contained and expose a clear public API
 * through this index.
 * 
 * **Module Architecture:**
 * ```
 * modules/
 * ├── conversationEngine/ - Conversation routing and intent processing
 * └── listening/         - Wake word and listening gate logic
 * ```
 */

// ===========================================================================
// CONVERSATION ENGINE EXPORTS
// ===========================================================================

export {
  // Main functions
  initializeConversationEngine,
  route,
  respond,
  testPatterns,
} from './conversationEngine';

// ===========================================================================
// LISTENING MODULE EXPORTS
// ===========================================================================

export {
  // Main gate function
  passGate,
  
  // Helper functions
  isAddressedToChango,
  stripWakeWord,
} from './listening/gate';