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

  private constructor() {
    this.state = {
      mute: false,
      speaking: false,
      power: true, // Start with power ON by default
    };
    this.listeners = new Set();
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
    this.state.power = power;
    if (!power) {
      // If turning off power, stop all speech
      this.cancelSpeak();
    }
    this.notifyListeners();
  }

  setMute(mute: boolean): void {
    this.state.mute = mute;
    if (mute) {
      // If muting, stop all speech
      this.cancelSpeak();
    }
    this.notifyListeners();
  }

  setSpeaking(speaking: boolean): void {
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