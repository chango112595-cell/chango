/**
 * Local Neural TTS Provider
 * Uses the Web Speech API (window.speechSynthesis) for 100% local text-to-speech
 */

import { TTSProvider, TTSSpeakOptions } from '../interfaces';

/**
 * LocalNeuralProvider class
 * Implements TTSProvider interface using browser's built-in speech synthesis
 */
export class LocalNeuralProvider implements TTSProvider {
  readonly id = 'local-neural';
  readonly name = 'Local Neural TTS';
  
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private voiceLoadPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
    }
  }

  /**
   * Load available voices from the browser
   */
  private loadVoices(): void {
    if (!this.synthesis) return;

    // Create a promise that resolves when voices are loaded
    this.voiceLoadPromise = new Promise<void>((resolve) => {
      const loadVoiceList = () => {
        this.availableVoices = this.synthesis!.getVoices();
        this.voicesLoaded = this.availableVoices.length > 0;
        
        if (this.voicesLoaded) {
          console.log(`[LocalNeuralProvider] Loaded ${this.availableVoices.length} voices`);
          resolve();
        }
      };

      // Load immediately
      loadVoiceList();

      // Also listen for the voiceschanged event
      if (this.synthesis && 'onvoiceschanged' in this.synthesis) {
        this.synthesis.onvoiceschanged = () => {
          loadVoiceList();
        };
      }

      // Fallback: resolve after a timeout even if no voices loaded
      setTimeout(() => {
        if (!this.voicesLoaded) {
          console.warn('[LocalNeuralProvider] Voice loading timed out, using defaults');
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Check if the provider is available
   */
  isAvailable(): boolean {
    return this.synthesis !== null && typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Find the best matching voice for the given options
   */
  private async findBestVoice(options?: TTSSpeakOptions): Promise<SpeechSynthesisVoice | null> {
    // Ensure voices are loaded
    if (!this.voicesLoaded && this.voiceLoadPromise) {
      await this.voiceLoadPromise;
    }

    if (this.availableVoices.length === 0) {
      console.warn('[LocalNeuralProvider] No voices available');
      return null;
    }

    const locale = options?.locale || 'en-US';
    const preferredVoice = options?.voice;

    // First try to find exact match by name
    if (preferredVoice) {
      const exactMatch = this.availableVoices.find(v => 
        v.name === preferredVoice || v.name.includes(preferredVoice)
      );
      if (exactMatch) return exactMatch;
    }

    // Try to find a voice matching the locale
    const localeMatches = this.availableVoices.filter(v => v.lang.startsWith(locale.split('-')[0]));
    
    if (localeMatches.length > 0) {
      // Prefer local voices over remote
      const localVoices = localeMatches.filter(v => v.localService);
      if (localVoices.length > 0) return localVoices[0];
      
      // Return first matching locale
      return localeMatches[0];
    }

    // Fallback to first available voice
    return this.availableVoices[0];
  }

  /**
   * Speak the given text
   */
  async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Local Neural TTS is not available');
    }

    // Cancel any ongoing speech if interrupting
    if (options?.interrupt !== false) {
      this.stop();
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;

        // Find and set the best voice
        const voice = await this.findBestVoice(options);
        if (voice) {
          utterance.voice = voice;
          console.log(`[LocalNeuralProvider] Using voice: ${voice.name} (${voice.lang})`);
        }

        // Apply speech parameters
        utterance.pitch = options?.pitch ?? 1.0;
        utterance.rate = options?.rate ?? 1.0;
        utterance.volume = options?.volume ?? 1.0;

        // Set language if specified
        if (options?.locale) {
          utterance.lang = options.locale;
        }

        // Handle events
        utterance.onend = () => {
          this.currentUtterance = null;
          console.log('[LocalNeuralProvider] Speech completed');
          resolve();
        };

        utterance.onerror = (event) => {
          this.currentUtterance = null;
          console.error('[LocalNeuralProvider] Speech error:', event.error);
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        // Speak the utterance
        console.log(`[LocalNeuralProvider] Speaking: "${text.substring(0, 50)}..."`);
        this.synthesis!.speak(utterance);

        // Handle edge case where speech doesn't start
        setTimeout(() => {
          if (this.currentUtterance === utterance && !this.synthesis!.speaking) {
            console.warn('[LocalNeuralProvider] Speech did not start, resolving anyway');
            this.currentUtterance = null;
            resolve();
          }
        }, 100);

      } catch (error) {
        this.currentUtterance = null;
        console.error('[LocalNeuralProvider] Failed to speak:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (!this.synthesis) return;

    if (this.synthesis.speaking || this.synthesis.pending) {
      console.log('[LocalNeuralProvider] Stopping speech');
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Get list of available voice names
   */
  async getVoices(): Promise<string[]> {
    // Ensure voices are loaded
    if (!this.voicesLoaded && this.voiceLoadPromise) {
      await this.voiceLoadPromise;
    }

    return this.availableVoices.map(v => v.name);
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking ?? false;
  }

  /**
   * Pause current speech
   */
  pause(): void {
    if (this.synthesis && this.synthesis.speaking) {
      console.log('[LocalNeuralProvider] Pausing speech');
      this.synthesis.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.synthesis && this.synthesis.paused) {
      console.log('[LocalNeuralProvider] Resuming speech');
      this.synthesis.resume();
    }
  }
}

// Export a singleton instance for convenience
export const localNeuralProvider = new LocalNeuralProvider();