/**
 * LegacySTT - Web Speech API based Speech-to-Text
 * Emits userSpeechRecognized events via VoiceBus
 */

import { voiceBus } from './voiceBus';

// TypeScript declarations for Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

declare const window: IWindow;

export class LegacySTT {
  private recognition: any;
  private isListening: boolean = false;
  private language: string = 'en-US';
  private continuous: boolean = true;
  private interimResults: boolean = true;
  private maxAlternatives: number = 1;

  constructor(options?: {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    maxAlternatives?: number;
  }) {
    // Initialize with options
    if (options) {
      this.language = options.language || this.language;
      this.continuous = options.continuous !== undefined ? options.continuous : this.continuous;
      this.interimResults = options.interimResults !== undefined ? options.interimResults : this.interimResults;
      this.maxAlternatives = options.maxAlternatives || this.maxAlternatives;
    }

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('[LegacySTT] Web Speech API not supported in this browser');
      throw new Error('Web Speech API not supported');
    }

    // Create recognition instance
    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  private setupRecognition(): void {
    // Configure recognition
    this.recognition.lang = this.language;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.maxAlternatives = this.maxAlternatives;

    // Handle results
    this.recognition.onresult = (event: any) => {
      console.log('[LegacySTT] Speech result received');
      
      // Get the last result
      const lastResultIndex = event.results.length - 1;
      const result = event.results[lastResultIndex];
      
      // Check if the result is final
      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence || 1.0;
        
        console.log(`[LegacySTT] Final transcript: "${transcript}" (confidence: ${confidence})`);
        
        // Emit userSpeechRecognized event via VoiceBus
        if (transcript.length > 0) {
          voiceBus.emitUserSpeech(transcript);
        }
      } else if (this.interimResults) {
        // Handle interim results if enabled
        const transcript = result[0].transcript.trim();
        console.log(`[LegacySTT] Interim transcript: "${transcript}"`);
        
        // You could emit interim results with a different event if needed
        // For now, we'll only emit final results
      }
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('[LegacySTT] Recognition error:', event.error);
      
      // Handle specific errors
      switch (event.error) {
        case 'no-speech':
          console.log('[LegacySTT] No speech detected');
          break;
        case 'audio-capture':
          console.error('[LegacySTT] No microphone found or permission denied');
          break;
        case 'not-allowed':
          console.error('[LegacySTT] Microphone permission denied');
          break;
        case 'network':
          console.error('[LegacySTT] Network error occurred');
          break;
        default:
          console.error('[LegacySTT] Unknown error:', event.error);
      }
      
      this.isListening = false;
    };

    // Handle start
    this.recognition.onstart = () => {
      console.log('[LegacySTT] Recognition started');
      this.isListening = true;
    };

    // Handle end
    this.recognition.onend = () => {
      console.log('[LegacySTT] Recognition ended');
      this.isListening = false;
      
      // Restart if continuous mode is enabled and we're supposed to be listening
      if (this.continuous && this.isListening) {
        console.log('[LegacySTT] Restarting continuous recognition');
        this.start();
      }
    };

    // Handle speech start
    this.recognition.onspeechstart = () => {
      console.log('[LegacySTT] Speech detected');
    };

    // Handle speech end
    this.recognition.onspeechend = () => {
      console.log('[LegacySTT] Speech ended');
    };

    // Handle no match
    this.recognition.onnomatch = () => {
      console.log('[LegacySTT] No speech match found');
    };

    // Handle sound start (includes non-speech sounds)
    this.recognition.onsoundstart = () => {
      console.log('[LegacySTT] Sound detected');
    };

    // Handle sound end
    this.recognition.onsoundend = () => {
      console.log('[LegacySTT] Sound ended');
    };
  }

  /**
   * Set the recognition language
   */
  setLang(language: string): void {
    console.log(`[LegacySTT] Setting language to: ${language}`);
    this.language = language;
    this.recognition.lang = language;
    
    // If currently listening, restart with new language
    if (this.isListening) {
      this.stop();
      setTimeout(() => this.start(), 100);
    }
  }

  /**
   * Start listening for speech
   */
  start(): void {
    if (this.isListening) {
      console.log('[LegacySTT] Already listening');
      return;
    }

    console.log('[LegacySTT] Starting recognition');
    
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error: any) {
      console.error('[LegacySTT] Failed to start recognition:', error);
      
      // Handle the case where recognition is already started
      if (error.message && error.message.includes('already started')) {
        console.log('[LegacySTT] Recognition was already started, stopping and restarting');
        this.stop();
        setTimeout(() => this.start(), 100);
      }
    }
  }

  /**
   * Stop listening for speech
   */
  stop(): void {
    if (!this.isListening) {
      console.log('[LegacySTT] Not currently listening');
      return;
    }

    console.log('[LegacySTT] Stopping recognition');
    
    try {
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('[LegacySTT] Failed to stop recognition:', error);
    }
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Get current language
   */
  getLanguage(): string {
    return this.language;
  }

  /**
   * Set continuous mode
   */
  setContinuous(continuous: boolean): void {
    this.continuous = continuous;
    this.recognition.continuous = continuous;
  }

  /**
   * Set interim results
   */
  setInterimResults(interimResults: boolean): void {
    this.interimResults = interimResults;
    this.recognition.interimResults = interimResults;
  }

  /**
   * Destroy the recognition instance
   */
  destroy(): void {
    this.stop();
    this.recognition = null;
  }
}

// Export a singleton instance for convenience
let instance: LegacySTT | null = null;

export const getLegacySTT = (options?: Parameters<typeof LegacySTT['constructor']>[0]): LegacySTT => {
  if (!instance) {
    try {
      instance = new LegacySTT(options);
    } catch (error) {
      console.error('[LegacySTT] Failed to create instance:', error);
      throw error;
    }
  }
  return instance;
};

// Export a hook-friendly version for React components
export const useLegacySTT = (options?: Parameters<typeof LegacySTT['constructor']>[0]) => {
  const [stt, setStt] = useState<LegacySTT | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const sttInstance = getLegacySTT(options);
      setStt(sttInstance);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize STT');
    }
  }, []);

  const start = useCallback(() => {
    if (stt) {
      stt.start();
      setIsListening(true);
    }
  }, [stt]);

  const stop = useCallback(() => {
    if (stt) {
      stt.stop();
      setIsListening(false);
    }
  }, [stt]);

  const setLanguage = useCallback((lang: string) => {
    if (stt) {
      stt.setLang(lang);
    }
  }, [stt]);

  return {
    stt,
    isListening,
    error,
    start,
    stop,
    setLanguage,
  };
};

// React import for the hook
import { useState, useEffect, useCallback } from 'react';