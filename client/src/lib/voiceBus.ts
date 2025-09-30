/**
 * Global VoiceBus State Manager
 * Singleton pattern to manage voice state globally across all components
 */

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
export const isPowerOn = () => VoiceBus.getState().power;
export const isMuted = () => VoiceBus.getState().mute;
export const isSpeaking = () => VoiceBus.getState().speaking;