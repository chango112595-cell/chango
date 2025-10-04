/**
 * Wake Word Detection Module
 * Listens for "chango" or "hey chango" to activate the assistant
 */

import { voiceBus } from './voiceBus';
import { Voice } from '../lib/voiceController';
import { WAKE_WORD_VARIATIONS, containsWakeWord as checkWakeWord } from '../config/wakeword';

export interface WakeWordConfig {
  wakeWords?: string[];
  sensitivity?: number;
  windowDuration?: number;
  cooldownDuration?: number;
}

class WakeWordDetector {
  private wakeWords: string[] = WAKE_WORD_VARIATIONS;
  private isEnabled: boolean = false;
  private lastWakeTime: number = 0;
  private cooldownDuration: number = 2000; // 2 seconds cooldown
  private windowDuration: number = 10000; // 10 seconds active window
  private unsubscribe: (() => void) | null = null;

  constructor(config?: WakeWordConfig) {
    if (config?.wakeWords) {
      this.wakeWords = config.wakeWords;
    }
    if (config?.windowDuration) {
      this.windowDuration = config.windowDuration;
    }
    if (config?.cooldownDuration) {
      this.cooldownDuration = config.cooldownDuration;
    }

    console.log('[WakeWord] Detector initialized with words:', this.wakeWords);
  }

  /**
   * Enable wake word detection
   */
  enable(): void {
    if (this.isEnabled) {
      console.log('[WakeWord] Already enabled');
      return;
    }

    console.log('[WakeWord] Enabling wake word detection');
    this.isEnabled = true;

    // Subscribe to user speech events
    this.unsubscribe = voiceBus.on('userSpeechRecognized', (event) => {
      if (!this.isEnabled) return;
      
      // Don't process if we're in cooldown
      const now = Date.now();
      if (now - this.lastWakeTime < this.cooldownDuration) {
        console.log('[WakeWord] In cooldown period, ignoring');
        return;
      }

      // Don't process if already in ACTIVE mode
      if (Voice.getMode() === 'ACTIVE') {
        console.log('[WakeWord] Already in ACTIVE mode');
        return;
      }

      // Don't process if system is speaking
      if (Voice.isSpeaking()) {
        console.log('[WakeWord] System is speaking, ignoring');
        return;
      }

      // Check for wake word in transcript
      if (event.text && this.containsWakeWord(event.text)) {
        console.log('[WakeWord] Wake word detected!', event.text);
        this.handleWakeWordDetected();
      }
    });

    console.log('[WakeWord] Wake word detection enabled');
  }

  /**
   * Disable wake word detection
   */
  disable(): void {
    if (!this.isEnabled) {
      console.log('[WakeWord] Already disabled');
      return;
    }

    console.log('[WakeWord] Disabling wake word detection');
    this.isEnabled = false;

    // Unsubscribe from events
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    console.log('[WakeWord] Wake word detection disabled');
  }

  /**
   * Check if text contains wake word
   * Uses centralized wake word checking
   */
  private containsWakeWord(text: string): boolean {
    return checkWakeWord(text);
  }

  /**
   * Handle wake word detection
   */
  private handleWakeWordDetected(): void {
    const now = Date.now();
    this.lastWakeTime = now;

    // Notify the Voice controller
    Voice.wakeWordHeard();

    // Play a sound or visual feedback
    this.playWakeSound();

    // Emit wake event
    voiceBus.emit({
      type: 'stateChange',
      text: 'Wake word detected',
      source: 'system'
    });

    console.log(`[WakeWord] Activated! Window open for ${this.windowDuration}ms`);
  }

  /**
   * Play wake sound (optional audio feedback)
   */
  private playWakeSound(): void {
    try {
      // Create a simple beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure the beep
      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1; // Volume

      // Play the beep for 100ms
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);

      console.log('[WakeWord] Played wake sound');
    } catch (error) {
      console.log('[WakeWord] Could not play wake sound:', error);
    }
  }

  /**
   * Get detector status
   */
  getStatus(): {
    isEnabled: boolean;
    wakeWords: string[];
    windowDuration: number;
    lastWakeTime: number;
  } {
    return {
      isEnabled: this.isEnabled,
      wakeWords: this.wakeWords,
      windowDuration: this.windowDuration,
      lastWakeTime: this.lastWakeTime
    };
  }

  /**
   * Update wake words
   */
  setWakeWords(words: string[]): void {
    this.wakeWords = words;
    console.log('[WakeWord] Updated wake words:', words);
  }

  /**
   * Check if currently in wake window
   */
  isInWakeWindow(): boolean {
    const now = Date.now();
    return (now - this.lastWakeTime) < this.windowDuration;
  }
}

// Export singleton instance
export const wakeWordDetector = new WakeWordDetector();