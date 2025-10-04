/**
 * Services Module Index
 * =====================
 * 
 * @module services
 * @description Central export point for application services.
 * 
 * Services handle business logic and external integrations.
 * They should be stateless where possible and focus on a single
 * domain of functionality.
 * 
 * **Module Architecture:**
 * ```
 * services/
 * └── responder.ts - Message response generation
 * ```
 */

// ===========================================================================
// RESPONDER SERVICE EXPORTS
// ===========================================================================

export {
  // Singleton instance
  responder,
  
  // Class export
  Responder,
  
  // Types
  type ResponseOptions,
  type Command,
} from './responder';

// ===========================================================================
// SERVICE UTILITIES
// ===========================================================================

/**
 * Check if all services are initialized
 */
export function areServicesReady(): boolean {
  const { responder } = require('./responder');
  return responder !== undefined && responder !== null;
}

/**
 * Reset all services to initial state
 */
export function resetServices(): void {
  const { responder } = require('./responder');
  if (responder) {
    responder.clearCustomCommands();
  }
}