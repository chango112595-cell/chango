/**
 * Global VoiceBus State Manager
 * Singleton pattern to manage voice state globally across all components
 * Integrates with Voice controller for unified state management
 */

import { Voice } from './voiceController';

interface VoiceBusState {
  mute: boolean;
  speaking: boolean;
  power: boolean;
}

// Define VoiceEvent type for async event handling
interface VoiceEvent {
  type: 'cancel' | 'muteChange' | 'powerChange' | 'speakingChange' | 'stateChange';
  source?: 'user' | 'system';
  muted?: boolean;
  powered?: boolean;
  speaking?: boolean;
  state?: VoiceBusState;
}

class VoiceBusManager {
  private static instance: VoiceBusManager;
  private state: VoiceBusState;
  private listeners: Set<(state: VoiceBusState) => void>;
  private eventListeners: Set<(event: VoiceEvent) => void>;
  private isTransitioning: boolean = false;
  private _isCancelling: boolean = false; // Re-entrancy guard for cancelSpeak

  private constructor() {
    this.state = {
      mute: false,
      speaking: false,
      power: true, // Start with power ON by default
    };
    this.listeners = new Set();
    this.eventListeners = new Set();
    this.isTransitioning = false;
    this._isCancelling = false;
    
    // Subscribe to Voice controller state changes for synchronization
    Voice.subscribe((voiceState) => {
      // Prevent re-entrant updates during transition
      if (this.isTransitioning) return;
      
      // Sync mute state with Voice controller mode
      const isMuted = voiceState.mode === 'MUTED' || voiceState.mode === 'KILLED';
      const isPowered = voiceState.mode !== 'KILLED';
      
      if (this.state.mute !== isMuted || this.state.power !== isPowered) {
        this.isTransitioning = true; // Set flag to prevent loops
        const previousMute = this.state.mute;
        const previousPower = this.state.power;
        
        this.state.mute = isMuted;
        this.state.power = isPowered;
        
        // Emit events asynchronously
        if (previousMute !== isMuted) {
          this.emitAsync({ type: 'muteChange', muted: isMuted, source: 'system' });
        }
        if (previousPower !== isPowered) {
          this.emitAsync({ type: 'powerChange', powered: isPowered, source: 'system' });
        }
        
        this.notifyListeners();
        this.isTransitioning = false; // Clear flag after notification
      }
    });
  }

  static getInstance(): VoiceBusManager {
    if (!VoiceBusManager.instance) {
      VoiceBusManager.instance = new VoiceBusManager();
    }
    return VoiceBusManager.instance;
  }

  getState(): VoiceBusState {
    return { ...this.state };
  }

  // Emit events asynchronously to avoid inline recursion
  private emitAsync(event: VoiceEvent): void {
    // Include current state in the event
    event.state = this.getState();
    
    // Copy listeners to avoid mutation during iteration
    const listeners = Array.from(this.eventListeners);
    
    // Use queueMicrotask for async emission
    for (const listener of listeners) {
      queueMicrotask(() => listener(event));
    }
  }

  setPower(power: boolean): void {
    // Guard against same state or transitioning
    if (this.state.power === power || this.isTransitioning) return;
    
    this.isTransitioning = true;
    this.state.power = power;
    
    if (!power) {
      // If turning off power, stop all speech
      this.cancelSpeak('system');
    }
    
    // Emit power change event asynchronously
    this.emitAsync({ type: 'powerChange', powered: power, source: 'user' });
    
    this.notifyListeners();
    this.isTransitioning = false;
  }

  setMute(mute: boolean): void {
    // Guard against same state or transitioning
    if (this.state.mute === mute || this.isTransitioning) return;
    
    this.isTransitioning = true;
    this.state.mute = mute;
    
    // Sync with Voice controller
    if (mute && Voice.getMode() === 'ACTIVE') {
      Voice.toggleMute(); // Will set to MUTED
    } else if (!mute && Voice.getMode() === 'MUTED') {
      Voice.toggleMute(); // Will set to ACTIVE
    }
    
    if (mute) {
      // If muting, stop all speech
      this.cancelSpeak('system');
    }
    
    // Emit mute change event asynchronously
    this.emitAsync({ type: 'muteChange', muted: mute, source: 'user' });
    
    this.notifyListeners();
    this.isTransitioning = false;
  }

  setSpeaking(speaking: boolean): void {
    // Guard against same state or transitioning
    if (this.state.speaking === speaking || this.isTransitioning) return;
    
    this.state.speaking = speaking;
    
    // NOTE: Removed Voice.speaking() call here to prevent circular dependency
    // Voice controller should be notified directly by the component that initiates speech
    
    // Emit speaking change event asynchronously
    this.emitAsync({ type: 'speakingChange', speaking: speaking, source: 'system' });
    
    this.notifyListeners();
  }

  cancelSpeak(source: 'user' | 'system' = 'user'): void {
    // Re-entrancy guard to prevent stack overflow
    if (this._isCancelling) return;
    
    this._isCancelling = true;
    try {
      // Cancel all ongoing speech synthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Clear internal state if needed
      this.state.speaking = false;
    } finally {
      this._isCancelling = false;
    }
    
    // Fire cancel event AFTER exiting cancelling state, and async
    this.emitAsync({ type: 'cancel', source });
    
    // Notify traditional listeners (backwards compatibility)
    this.notifyListeners();
  }

  // Subscribe to state changes (backwards compatible)
  subscribe(listener: (state: VoiceBusState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // New event-based subscription for async handling
  on(listener: (event: VoiceEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => listener(currentState));
  }
}

// Export singleton instance
export const VoiceBus = VoiceBusManager.getInstance();

// Export convenience functions
export const cancelSpeak = (source: 'user' | 'system' = 'user') => VoiceBus.cancelSpeak(source);
export const isPowerOn = () => {
  // Check both VoiceBus and Voice controller states
  const busState = VoiceBus.getState();
  const voiceMode = Voice.getMode();
  return busState.power && voiceMode !== 'KILLED';
};
export const isMuted = () => {
  // Check both VoiceBus and Voice controller states
  const busState = VoiceBus.getState();
  const voiceMode = Voice.getMode();
  return busState.mute || voiceMode === 'MUTED' || voiceMode === 'KILLED';
};
export const isSpeaking = () => VoiceBus.getState().speaking;