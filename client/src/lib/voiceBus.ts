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

class VoiceBusManager {
  private static instance: VoiceBusManager;
  private state: VoiceBusState;
  private listeners: Set<(state: VoiceBusState) => void>;
  private isTransitioning: boolean = false;

  private constructor() {
    this.state = {
      mute: false,
      speaking: false,
      power: true, // Start with power ON by default
    };
    this.listeners = new Set();
    this.isTransitioning = false;
    
    // Subscribe to Voice controller state changes for synchronization
    Voice.subscribe((voiceState) => {
      // Sync mute state with Voice controller mode
      const isMuted = voiceState.mode === 'MUTED' || voiceState.mode === 'KILLED';
      const isPowered = voiceState.mode !== 'KILLED';
      
      if (this.state.mute !== isMuted || this.state.power !== isPowered) {
        this.state.mute = isMuted;
        this.state.power = isPowered;
        this.notifyListeners();
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

  setPower(power: boolean): void {
    // Guard against same state or transitioning
    if (this.state.power === power || this.isTransitioning) return;
    
    this.isTransitioning = true;
    this.state.power = power;
    if (!power) {
      // If turning off power, stop all speech
      this.cancelSpeak();
    }
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
      this.cancelSpeak();
    }
    this.notifyListeners();
    this.isTransitioning = false;
  }

  setSpeaking(speaking: boolean): void {
    // Guard against same state or transitioning
    if (this.state.speaking === speaking || this.isTransitioning) return;
    
    this.state.speaking = speaking;
    
    // Sync with Voice controller
    Voice.speaking(speaking);
    
    this.notifyListeners();
  }

  cancelSpeak(): void {
    // Cancel all ongoing speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.state.speaking = false;
    this.notifyListeners();
  }

  // Subscribe to state changes
  subscribe(listener: (state: VoiceBusState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
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
export const cancelSpeak = () => VoiceBus.cancelSpeak();
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