/**
 * Enhanced VoiceBus Event Management System
 * Re-entrancy safe with async event emission to prevent stack overflows
 */

import { debugBus } from '../dev/debugBus';

export interface VoiceBusEvent {
  type: string;
  source?: string;
  data?: any;
  timestamp?: number;
}

export type VoiceBusListener = (event: VoiceBusEvent) => void | Promise<void>;

export class VoiceBus {
  private listeners: Map<string, VoiceBusListener[]> = new Map();
  private allListeners: VoiceBusListener[] = [];
  private isEmitting = false;
  private eventQueue: VoiceBusEvent[] = [];
  
  /**
   * Subscribe to specific event types
   */
  on(eventType: string, listener: VoiceBusListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const listeners = this.listeners.get(eventType)!;
    listeners.push(listener);
    
    debugBus.info('VoiceBus', 'listener_added', { eventType, count: listeners.length });
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
        debugBus.info('VoiceBus', 'listener_removed', { eventType, remaining: listeners.length });
      }
    };
  }
  
  /**
   * Subscribe to all events
   */
  onAll(listener: VoiceBusListener): () => void {
    this.allListeners.push(listener);
    
    debugBus.info('VoiceBus', 'all_listener_added', { count: this.allListeners.length });
    
    // Return unsubscribe function
    return () => {
      const index = this.allListeners.indexOf(listener);
      if (index > -1) {
        this.allListeners.splice(index, 1);
        debugBus.info('VoiceBus', 'all_listener_removed', { remaining: this.allListeners.length });
      }
    };
  }
  
  /**
   * Emit an event with re-entrancy protection
   */
  emit(event: VoiceBusEvent): void {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // Queue event if already emitting (re-entrancy protection)
    if (this.isEmitting) {
      this.eventQueue.push(event);
      debugBus.info('VoiceBus', 'event_queued', { 
        type: event.type, 
        queueLength: this.eventQueue.length 
      });
      return;
    }
    
    // Use queueMicrotask for async emission to prevent stack overflows
    queueMicrotask(() => {
      this.processEvent(event);
      this.processQueue();
    });
  }
  
  /**
   * Emit a cancel event with high priority
   */
  cancel(source: string = 'system'): void {
    const cancelEvent: VoiceBusEvent = {
      type: 'cancel',
      source,
      timestamp: Date.now()
    };
    
    // Clear any queued events when canceling
    this.eventQueue = [];
    
    debugBus.info('VoiceBus', 'cancel_emitted', { source });
    
    // Process cancel immediately and ensure isEmitting is reset after
    queueMicrotask(async () => {
      await this.processEvent(cancelEvent);
      // Ensure isEmitting is reset after cancel completes
      this.isEmitting = false;
    });
  }
  
  /**
   * Process a single event
   */
  private async processEvent(event: VoiceBusEvent): Promise<void> {
    this.isEmitting = true;
    
    try {
      // Notify type-specific listeners
      const typeListeners = this.listeners.get(event.type) || [];
      for (const listener of typeListeners) {
        try {
          await Promise.resolve(listener(event));
        } catch (error) {
          console.error(`[VoiceBus] Error in listener for ${event.type}:`, error);
        }
      }
      
      // Notify all-event listeners
      for (const listener of this.allListeners) {
        try {
          await Promise.resolve(listener(event));
        } catch (error) {
          console.error('[VoiceBus] Error in all-event listener:', error);
        }
      }
    } finally {
      this.isEmitting = false;
    }
  }
  
  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    while (this.eventQueue.length > 0 && !this.isEmitting) {
      const event = this.eventQueue.shift()!;
      await this.processEvent(event);
    }
  }
  
  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.allListeners = [];
    this.eventQueue = [];
    this.isEmitting = false;
    
    debugBus.info('VoiceBus', 'cleared', {});
  }
  
  /**
   * Get listener counts for debugging
   */
  getListenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {
      _all: this.allListeners.length
    };
    
    this.listeners.forEach((listeners, type) => {
      counts[type] = listeners.length;
    });
    
    return counts;
  }
}

// Create singleton instance
export const voiceBus = new VoiceBus();

// Export convenience functions
export const emitVoiceEvent = (event: VoiceBusEvent) => voiceBus.emit(event);
export const cancelVoice = (source?: string) => voiceBus.cancel(source);
export const onVoiceEvent = (type: string, listener: VoiceBusListener) => voiceBus.on(type, listener);
export const onAllVoiceEvents = (listener: VoiceBusListener) => voiceBus.onAll(listener);