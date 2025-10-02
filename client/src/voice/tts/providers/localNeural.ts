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
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synthesis = window.speechSynthesis;
      // Don't auto-load voices in constructor - wait for explicit init
    }
  }

  /**
   * Initialize the provider and ensure voices are loaded
   * This should be called before using the provider
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return this.voicesLoaded;
    }

    if (!this.synthesis) {
      console.error('[LocalNeuralProvider] Speech synthesis not available');
      return false;
    }

    console.log('[LocalNeuralProvider] Initializing and loading voices...');
    await this.loadVoices();
    this.initialized = true;
    
    console.log(`[LocalNeuralProvider] Initialization complete. Voices loaded: ${this.availableVoices.length}`);
    return this.availableVoices.length > 0;
  }

  /**
   * Load available voices from the browser with robust retry logic
   */
  private loadVoices(): Promise<void> {
    if (!this.synthesis) return Promise.resolve();

    // Return existing promise if already loading
    if (this.voiceLoadPromise) {
      return this.voiceLoadPromise;
    }

    // Create a promise that resolves when voices are loaded
    this.voiceLoadPromise = new Promise<void>((resolve) => {
      let resolved = false;
      let attemptCount = 0;
      const maxAttempts = 50; // More attempts for stubborn browsers
      
      const loadVoiceList = () => {
        attemptCount++;
        const voices = this.synthesis!.getVoices();
        console.log(`[LocalNeuralProvider] Attempt ${attemptCount}: getVoices() returned ${voices.length} voices`);
        
        if (voices.length > 0) {
          this.availableVoices = voices;
          this.voicesLoaded = true;
          console.log(`[LocalNeuralProvider] Successfully loaded ${voices.length} voices`);
          
          // Log first few voice names for debugging
          const sampleVoices = voices.slice(0, 3).map(v => `${v.name} (${v.lang})`).join(', ');
          console.log(`[LocalNeuralProvider] Sample voices: ${sampleVoices}`);
          
          if (!resolved) {
            resolved = true;
            resolve();
          }
          return true;
        }
        return false;
      };

      // Try loading voices immediately
      if (loadVoiceList()) {
        return;
      }

      // Set up voice changed listener (critical for Chrome/Edge)
      const voicesChangedHandler = () => {
        console.log('[LocalNeuralProvider] voiceschanged event fired');
        if (loadVoiceList()) {
          // Remove listener once voices are loaded
          this.synthesis!.removeEventListener('voiceschanged', voicesChangedHandler);
        }
      };
      
      this.synthesis.addEventListener('voiceschanged', voicesChangedHandler);

      // Also use the property for older browsers
      this.synthesis.onvoiceschanged = voicesChangedHandler;

      // Aggressive retry strategy with exponential backoff
      let retryDelay = 10;
      const retryInterval = setInterval(() => {
        if (this.voicesLoaded || attemptCount >= maxAttempts) {
          clearInterval(retryInterval);
          if (!this.voicesLoaded) {
            console.warn(`[LocalNeuralProvider] Failed to load voices after ${maxAttempts} attempts`);
            // Still resolve to prevent hanging
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }
          return;
        }

        // Try to trigger voice loading by creating a dummy utterance every 5 attempts
        if (attemptCount % 5 === 0) {
          console.log('[LocalNeuralProvider] Attempting to trigger voice loading with dummy utterance...');
          try {
            const dummy = new SpeechSynthesisUtterance('');
            dummy.volume = 0;
            this.synthesis!.speak(dummy);
            this.synthesis!.cancel();
          } catch (e) {
            console.debug('[LocalNeuralProvider] Dummy utterance failed:', e);
          }
        }

        loadVoiceList();
        
        // Increase delay for next retry (exponential backoff with cap)
        retryDelay = Math.min(retryDelay * 1.2, 200);
      }, retryDelay);

      // Final timeout after 10 seconds (was 3 seconds, increase for stubborn browsers)
      setTimeout(() => {
        if (!resolved) {
          console.warn('[LocalNeuralProvider] Voice loading timed out after 10 seconds');
          clearInterval(retryInterval);
          this.synthesis!.removeEventListener('voiceschanged', voicesChangedHandler);
          resolved = true;
          resolve();
        }
      }, 10000);
    });

    return this.voiceLoadPromise;
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

    // Ensure voices are loaded first
    if (!this.voicesLoaded && this.voiceLoadPromise) {
      console.log('[LocalNeuralProvider] Waiting for voices to load before speaking...');
      await this.voiceLoadPromise;
    }

    // Cancel any ongoing speech if interrupting
    if (options?.interrupt !== false) {
      this.stop();
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        // Create the utterance
        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;

        // Find and set the best voice
        const voice = await this.findBestVoice(options);
        if (voice) {
          utterance.voice = voice;
          console.log(`[LocalNeuralProvider] Using voice: ${voice.name} (${voice.lang})`);
        } else {
          console.warn('[LocalNeuralProvider] No voice found, using browser default');
          // Don't set a voice - let the browser use its default
        }

        // Apply speech parameters
        utterance.pitch = options?.pitch ?? 1.0;
        utterance.rate = options?.rate ?? 1.0;
        utterance.volume = options?.volume ?? 1.0;

        // Set language if specified
        if (options?.locale) {
          utterance.lang = options.locale;
        }

        // Track if speech has started
        let speechStarted = false;

        // Handle events
        utterance.onstart = () => {
          speechStarted = true;
          console.log('[LocalNeuralProvider] Speech started');
        };

        utterance.onend = () => {
          this.currentUtterance = null;
          console.log('[LocalNeuralProvider] Speech completed successfully');
          resolve();
        };

        utterance.onerror = (event) => {
          this.currentUtterance = null;
          console.error('[LocalNeuralProvider] Speech error:', event.error);
          
          // If it's a canceled error and we haven't started speaking, try without voice
          if (event.error === 'canceled' && !speechStarted) {
            console.log('[LocalNeuralProvider] Retrying without specific voice...');
            const retryUtterance = new SpeechSynthesisUtterance(text);
            retryUtterance.pitch = utterance.pitch;
            retryUtterance.rate = utterance.rate;
            retryUtterance.volume = utterance.volume;
            
            retryUtterance.onend = () => {
              console.log('[LocalNeuralProvider] Retry successful');
              resolve();
            };
            
            retryUtterance.onerror = (retryEvent) => {
              console.error('[LocalNeuralProvider] Retry failed:', retryEvent.error);
              reject(new Error(`Speech synthesis error: ${retryEvent.error}`));
            };
            
            this.synthesis!.speak(retryUtterance);
          } else {
            reject(new Error(`Speech synthesis error: ${event.error}`));
          }
        };

        // Clear any pending speech first
        this.synthesis!.cancel();
        
        // Small delay to ensure cancel completes
        await new Promise(r => setTimeout(r, 10));

        // Speak the utterance
        console.log(`[LocalNeuralProvider] Attempting to speak: "${text.substring(0, 50)}..."`);
        console.log(`[LocalNeuralProvider] Available voices count: ${this.availableVoices.length}`);
        
        this.synthesis!.speak(utterance);

        // Handle edge case where speech doesn't start
        setTimeout(() => {
          if (this.currentUtterance === utterance && !this.synthesis!.speaking && !speechStarted) {
            console.warn('[LocalNeuralProvider] Speech did not start after 500ms, resolving');
            this.currentUtterance = null;
            resolve();
          }
        }, 500);

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