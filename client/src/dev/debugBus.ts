/**
 * Debug Bus System
 * Central event logging with history buffer and real-time monitoring
 */

export type DebugEventType = 'info' | 'warn' | 'error';

export interface DebugEvent {
  id: string;
  timestamp: number;
  time: string;
  type: DebugEventType;
  module: string;
  message: string;
  data?: any;
}

type DebugEventListener = (event: DebugEvent) => void;

class DebugBusSystem {
  private static instance: DebugBusSystem;
  private events: DebugEvent[] = [];
  private listeners: Set<DebugEventListener> = new Set();
  private maxEvents = 400;
  private eventCounter = 0;
  private enabled = true;

  private constructor() {
    // Expose to window in dev mode
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__CH_DEBUG__ = {
        bus: this,
        getEvents: () => this.getEvents(),
        clear: () => this.clear(),
        log: (module: string, message: string, data?: any) => 
          this.log('info', module, message, data),
        warn: (module: string, message: string, data?: any) => 
          this.log('warn', module, message, data),
        error: (module: string, message: string, data?: any) => 
          this.log('error', module, message, data),
        subscribe: (listener: DebugEventListener) => this.subscribe(listener),
        enable: () => this.enable(),
        disable: () => this.disable()
      };
      console.log('[DebugBus] Exposed to window.__CH_DEBUG__');
    }
  }

  static getInstance(): DebugBusSystem {
    if (!DebugBusSystem.instance) {
      DebugBusSystem.instance = new DebugBusSystem();
    }
    return DebugBusSystem.instance;
  }

  /**
   * Log an event to the debug bus
   */
  log(type: DebugEventType, module: string, message: string, data?: any): void {
    if (!this.enabled) return;

    try {
      const now = new Date();
      const event: DebugEvent = {
        id: `${Date.now()}_${++this.eventCounter}`,
        timestamp: now.getTime(),
        time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`,
        type,
        module,
        message,
        data: data ? this.sanitizeData(data) : undefined
      };

      // Add to history buffer (with size limit)
      this.events.push(event);
      if (this.events.length > this.maxEvents) {
        this.events.shift(); // Remove oldest
      }

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          console.error('[DebugBus] Listener error:', err);
        }
      });

      // Also log to console in dev mode
      if (import.meta.env.DEV) {
        const consoleMethod = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[DebugBus] [${module}] ${message}`, data || '');
      }
    } catch (err) {
      console.error('[DebugBus] Failed to log event:', err);
    }
  }

  /**
   * Shorthand methods for different log types
   */
  info(module: string, message: string, data?: any): void {
    this.log('info', module, message, data);
  }

  warn(module: string, message: string, data?: any): void {
    this.log('warn', module, message, data);
  }

  error(module: string, message: string, data?: any): void {
    this.log('error', module, message, data);
  }

  /**
   * Subscribe to debug events
   */
  subscribe(listener: DebugEventListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current events
   */
  getEvents(): DebugEvent[] {
    return [...this.events];
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 14): DebugEvent[] {
    return this.events.slice(-count);
  }
  
  /**
   * Get event history
   */
  getHistory(): DebugEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    this.eventCounter = 0;
  }

  /**
   * Enable/disable debug bus
   */
  enable(): void {
    this.enabled = true;
    this.info('DebugBus', 'Debug bus enabled');
  }

  disable(): void {
    this.info('DebugBus', 'Debug bus disabled');
    this.enabled = false;
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sanitize data to prevent circular references
   */
  private sanitizeData(data: any): any {
    try {
      // Try to stringify and parse to remove circular references
      return JSON.parse(JSON.stringify(data, (key, value) => {
        // Handle common problematic values
        if (value instanceof Error) {
          return {
            error: true,
            message: value.message,
            stack: value.stack
          };
        }
        if (value instanceof HTMLElement) {
          return {
            element: value.tagName,
            id: value.id,
            className: value.className
          };
        }
        if (typeof value === 'function') {
          return '[Function]';
        }
        return value;
      }));
    } catch (err) {
      // If serialization fails, return a safe representation
      return {
        type: typeof data,
        toString: String(data).slice(0, 100)
      };
    }
  }
}

// Export singleton instance
export const debugBus = DebugBusSystem.getInstance();

// Export types for external use
export type { DebugEventListener };