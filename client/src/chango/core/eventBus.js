/**
 * EventBus - Central pub/sub messaging system for the voice application
 * Handles all inter-module communication with isolated error handling
 */
export class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(handler);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function to remove
   */
  off(event, handler) {
    if (!this.events.has(event)) return;
    
    const handlers = this.events.get(event);
    const index = handlers.indexOf(handler);
    
    if (index > -1) {
      handlers.splice(index, 1);
    }
    
    if (handlers.length === 0) {
      this.events.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to handlers
   */
  emit(event, ...args) {
    if (!this.events.has(event)) return;
    
    const handlers = this.events.get(event);
    
    // Isolated error handling - one handler's error doesn't affect others
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[EventBus] Error in handler for event '${event}':`, error);
      }
    });
  }
}

// Export singleton instance for global use
export const eventBus = new EventBus();