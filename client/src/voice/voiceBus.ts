/**
 * VoiceBus Event Management System
 * Lightweight event-driven architecture for voice interactions
 */

export type VoiceEventType = 
  | 'speak'
  | 'userSpeechRecognized'
  | 'userTextSubmitted'
  | 'changoResponse'
  | 'cancel'
  | 'muteChange'
  | 'powerChange'
  | 'speakingChange'
  | 'stateChange';

export interface VoiceEvent {
  type: VoiceEventType;
  text?: string;
  source?: 'user' | 'system' | 'conversation';
  muted?: boolean;
  powered?: boolean;
  speaking?: boolean;
  state?: {
    mute: boolean;
    speaking: boolean;
    power: boolean;
  };
}

class VoiceBusManager {
  private static instance: VoiceBusManager;
  private listeners: Map<VoiceEventType, Set<(event: VoiceEvent) => void>>;
  private state: {
    mute: boolean;
    speaking: boolean;
    power: boolean;
  };
  private _isCancelling: boolean = false;
  private _cancelScheduled: boolean = false;
  
  private constructor() {
    this.listeners = new Map();
    this.state = {
      mute: false,
      speaking: false,
      power: true
    };
  }
  
  static getInstance(): VoiceBusManager {
    if (!VoiceBusManager.instance) {
      VoiceBusManager.instance = new VoiceBusManager();
    }
    return VoiceBusManager.instance;
  }
  
  // Register event listener
  on(eventType: VoiceEventType, listener: (event: VoiceEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }
  
  // Emit event to all listeners
  emit(event: VoiceEvent): void {
    // Update state based on event type
    if (event.type === 'muteChange' && event.muted !== undefined) {
      this.state.mute = event.muted;
    }
    if (event.type === 'powerChange' && event.powered !== undefined) {
      this.state.power = event.powered;
    }
    if (event.type === 'speakingChange' && event.speaking !== undefined) {
      this.state.speaking = event.speaking;
    }
    
    // Add current state to event
    event.state = { ...this.state };
    
    // Emit to specific event type listeners
    const eventListeners = this.listeners.get(event.type);
    if (eventListeners) {
      const listenersArray = Array.from(eventListeners);
      // Use queueMicrotask for async emission
      for (const listener of listenersArray) {
        queueMicrotask(() => listener(event));
      }
    }
    
    // Also emit to 'stateChange' listeners for any state changes
    if (['muteChange', 'powerChange', 'speakingChange'].includes(event.type)) {
      const stateListeners = this.listeners.get('stateChange');
      if (stateListeners) {
        const stateListenersArray = Array.from(stateListeners);
        for (const listener of stateListenersArray) {
          queueMicrotask(() => listener({ ...event, type: 'stateChange' }));
        }
      }
    }
  }
  
  // Helper method: Emit speak event
  emitSpeak(text: string, source: 'user' | 'system' | 'conversation' = 'system'): void {
    this.emit({
      type: 'speak',
      text,
      source
    });
  }
  
  // Helper method: Emit user speech recognized
  emitUserSpeech(text: string): void {
    this.emit({
      type: 'userSpeechRecognized',
      text,
      source: 'user'
    });
  }
  
  // Helper method: Emit user text submitted
  emitUserText(text: string): void {
    this.emit({
      type: 'userTextSubmitted',
      text,
      source: 'user'
    });
  }
  
  // Mute/unmute functionality
  setMute(muted: boolean): void {
    if (this.state.mute === muted) return;
    
    this.state.mute = muted;
    
    if (muted) {
      // Cancel any ongoing speech
      this.cancelSpeak('system');
    }
    
    this.emit({
      type: 'muteChange',
      muted,
      source: 'system'
    });
  }
  
  // Power on/off functionality
  setPower(powered: boolean): void {
    if (this.state.power === powered) return;
    
    this.state.power = powered;
    
    if (!powered) {
      // Cancel any ongoing speech
      this.cancelSpeak('system');
    }
    
    this.emit({
      type: 'powerChange',
      powered,
      source: 'system'
    });
  }
  
  // Cancel speech with safe async handling
  cancelSpeak(source: 'user' | 'system' = 'user'): void {
    // Guard against multiple cancellation attempts
    if (this._isCancelling || this._cancelScheduled) {
      console.log('[VoiceBus] Cancel already in progress, skipping duplicate');
      return;
    }
    
    this._cancelScheduled = true;
    
    // Use queueMicrotask for async safe cancellation
    queueMicrotask(() => {
      if (!this._cancelScheduled) return;
      
      this._isCancelling = true;
      this._cancelScheduled = false;
      
      // Cancel browser speech synthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      this.state.speaking = false;
      
      // Emit cancel event asynchronously
      this.emit({
        type: 'cancel',
        source
      });
      
      // Reset guard flags after a small delay
      setTimeout(() => {
        this._isCancelling = false;
      }, 100);
    });
  }
  
  // Get current state
  getState() {
    return { ...this.state };
  }
  
  // Check if muted
  isMuted(): boolean {
    return this.state.mute;
  }
  
  // Check if powered
  isPowered(): boolean {
    return this.state.power;
  }
  
  // Check if speaking
  isSpeaking(): boolean {
    return this.state.speaking;
  }
  
  // Set speaking state
  setSpeaking(speaking: boolean): void {
    if (this.state.speaking === speaking) return;
    
    this.state.speaking = speaking;
    
    this.emit({
      type: 'speakingChange',
      speaking,
      source: 'system'
    });
  }
  
  // Clear all listeners (useful for cleanup)
  clearListeners(eventType?: VoiceEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }
}

// Export singleton instance
export const voiceBus = VoiceBusManager.getInstance();

// Export type for external use
export type { VoiceBusManager };