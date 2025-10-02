/**
 * VoiceBus Event Management System
 * Lightweight event-driven architecture for voice interactions
 */

import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';

export type VoiceEventType = 
  | 'speak'
  | 'userSpeechRecognized'
  | 'userTextSubmitted'
  | 'loloResponse'
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
  
  // Emit event to all listeners (synchronous)
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
      for (const listener of listenersArray) {
        listener(event);
      }
    }
    
    // Also emit to 'stateChange' listeners for any state changes
    if (['muteChange', 'powerChange', 'speakingChange'].includes(event.type)) {
      const stateListeners = this.listeners.get('stateChange');
      if (stateListeners) {
        const stateListenersArray = Array.from(stateListeners);
        for (const listener of stateListenersArray) {
          listener({ ...event, type: 'stateChange' });
        }
      }
    }
  }
  
  // Emit event asynchronously using queueMicrotask to prevent synchronous loops
  emitAsync(event: VoiceEvent): void {
    queueMicrotask(() => this.emit(event));
  }
  
  // Helper method: Emit speak event
  emitSpeak(text: string, source: 'user' | 'system' | 'conversation' = 'system'): void {
    this.emitAsync({
      type: 'speak',
      text,
      source
    });
  }
  
  // Helper method: Emit user speech recognized
  emitUserSpeech(text: string): void {
    this.emitAsync({
      type: 'userSpeechRecognized',
      text,
      source: 'user'
    });
  }
  
  // Helper method: Emit user text submitted
  emitUserText(text: string): void {
    console.log('[VoiceBus] 🚀 emitUserText called with:', text);
    console.log('[VoiceBus] Current listeners for userTextSubmitted:', this.listeners.get('userTextSubmitted')?.size || 0);
    
    this.emitAsync({
      type: 'userTextSubmitted',
      text,
      source: 'user'
    });
    
    console.log('[VoiceBus] ✅ userTextSubmitted event emitted');
  }
  
  // Mute/unmute functionality
  setMute(muted: boolean): void {
    if (this.state.mute === muted) return;
    
    this.state.mute = muted;
    
    // Log to debug bus
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VoiceBus', 'mute', { muted });
    }
    
    if (muted) {
      // Cancel any ongoing speech
      this.cancelSpeak('system');
    }
    
    this.emitAsync({
      type: 'muteChange',
      muted,
      source: 'system'
    });
  }
  
  // Power on/off functionality
  setPower(powered: boolean): void {
    if (this.state.power === powered) return;
    
    this.state.power = powered;
    
    // Log to debug bus
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('VoiceBus', 'power', { powered });
    }
    
    if (!powered) {
      // Cancel any ongoing speech
      this.cancelSpeak('system');
    }
    
    this.emitAsync({
      type: 'powerChange',
      powered,
      source: 'system'
    });
  }
  
  // Cancel speech with safe async handling and recursion guard
  cancelSpeak(source: 'user' | 'system' = 'user'): void {
    // Guard against recursion
    if (this._isCancelling) return;
    
    this._isCancelling = true;
    try {
      // Cancel browser speech synthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      this.state.speaking = false;
      
      // Log to debug bus
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('VoiceBus', 'cancel', { source });
      }
    } finally {
      this._isCancelling = false;
    }
    
    // Emit cancel event asynchronously
    this.emitAsync({
      type: 'cancel',
      source
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
    
    this.emitAsync({
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