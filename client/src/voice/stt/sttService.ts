/**
 * STT Service - Continuous Speech-to-Text with Web Speech API
 * Manages microphone permissions and continuous listening
 */

import { voiceBus } from '../voiceBus';
import { Voice } from '../../lib/voiceController';

// TypeScript declarations for Web Speech API
type SpeechRecognitionConstructor = any;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface STTConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

class STTService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isEnabled: boolean = false;
  private language: string = 'en-US';
  private continuous: boolean = true;
  private interimResults: boolean = true;
  private maxAlternatives: number = 1;
  private autoRestart: boolean = true;
  private lastTranscript: string = '';
  private silenceTimer: NodeJS.Timeout | null = null;
  private permissionGranted: boolean = false;

  constructor() {
    // DISABLED: STTService is no longer used - alwaysListen singleton handles all STT
    console.log('[STTService] 🔴 DISABLED - STT handled by alwaysListen singleton');
    // DO NOT create SpeechRecognition instance
    // DO NOT call setupRecognition()
    return; // Exit early to prevent any initialization
  }

  private setupRecognition(): void {
    // Configure recognition
    this.recognition.lang = this.language;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.maxAlternatives = this.maxAlternatives;

    // Handle results
    this.recognition.onresult = (event: any) => {
      // Get the last result
      const lastResultIndex = event.results.length - 1;
      const result = event.results[lastResultIndex];
      
      // Check if the result is final
      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence || 1.0;
        
        console.log(`[STTService] 🎯 Final transcript: "${transcript}" (confidence: ${confidence})`);
        console.log(`[STTService] 📊 Current mode: ${Voice.getMode()}, Speaking: ${Voice.isSpeaking()}`);
        
        // Don't process if we're speaking or should ignore input
        if (Voice.isSpeaking() || Voice.shouldIgnoreInput()) {
          console.log('[STTService] 🚫 Ignoring transcript (speaking or muted)');
          return;
        }
        
        // Emit speech recognized event via VoiceBus
        if (transcript.length > 0) {
          this.lastTranscript = transcript;
          console.log('[STTService] 📢 Emitting user speech event');
          voiceBus.emitUserSpeech(transcript);
          
          // Reset silence timer on speech
          this.resetSilenceTimer();
        }
      } else if (this.interimResults) {
        // Handle interim results
        const transcript = result[0].transcript.trim();
        console.log(`[STTService] 📝 Interim: "${transcript}"`);
        
        // For wake word detection, check interim results too
        if (Voice.getMode() === 'WAKE' && this.containsWakeWord(transcript)) {
          console.log('[STTService] 🎉 Wake word detected in interim result!');
          Voice.wakeWordHeard();
        }
      }
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('[STTService] Recognition error:', event.error);
      
      // Handle specific errors
      switch (event.error) {
        case 'no-speech':
          console.log('[STTService] No speech detected');
          // Auto-restart if enabled
          if (this.autoRestart && this.isEnabled) {
            this.restart();
          }
          break;
        case 'audio-capture':
          console.error('[STTService] No microphone found or permission denied');
          this.permissionGranted = false;
          this.isListening = false;
          break;
        case 'not-allowed':
          console.error('[STTService] Microphone permission denied');
          this.permissionGranted = false;
          this.isListening = false;
          break;
        case 'network':
          console.error('[STTService] Network error occurred');
          // Try to restart
          if (this.autoRestart && this.isEnabled) {
            setTimeout(() => this.restart(), 1000);
          }
          break;
        default:
          console.error('[STTService] Unknown error:', event.error);
          // Try to restart
          if (this.autoRestart && this.isEnabled) {
            setTimeout(() => this.restart(), 1000);
          }
      }
    };

    // Handle start
    this.recognition.onstart = () => {
      console.log('[STTService] ✅ Recognition STARTED - Microphone is now LISTENING!');
      this.isListening = true;
      this.permissionGranted = true;
      console.log('[STTService] 📊 Status:', { 
        isListening: true, 
        isEnabled: this.isEnabled, 
        mode: Voice.getMode() 
      });
    };

    // Handle end
    this.recognition.onend = () => {
      console.log('[STTService] ⏹️ Recognition ended');
      this.isListening = false;
      
      // Auto-restart if enabled and not speaking
      if (this.autoRestart && this.isEnabled && !Voice.isSpeaking()) {
        console.log('[STTService] 🔄 Auto-restarting recognition in 100ms');
        setTimeout(() => this.restart(), 100);
      } else {
        console.log('[STTService] ⏸️ Not restarting:', { 
          autoRestart: this.autoRestart, 
          isEnabled: this.isEnabled, 
          isSpeaking: Voice.isSpeaking() 
        });
      }
    };

    // Handle speech start
    this.recognition.onspeechstart = () => {
      console.log('[STTService] Speech detected');
      this.resetSilenceTimer();
    };

    // Handle speech end
    this.recognition.onspeechend = () => {
      console.log('[STTService] Speech ended');
      this.startSilenceTimer();
    };

    // Handle no match
    this.recognition.onnomatch = () => {
      console.log('[STTService] No speech match found');
    };
  }

  /**
   * Check if text contains wake word
   */
  private containsWakeWord(text: string): boolean {
    const lowercaseText = text.toLowerCase();
    return lowercaseText.includes('lolo') || 
           lowercaseText.includes('hey lolo') ||
           lowercaseText.includes('okay lolo');
  }

  /**
   * Request microphone permissions - DISABLED
   */
  async requestPermissions(): Promise<boolean> {
    // DISABLED: STT handled by alwaysListen singleton
    console.log('[STTService] 🔴 requestPermissions DISABLED - handled by alwaysListen');
    return true; // Always return true to prevent errors
  }

  /**
   * Start STT service - DISABLED
   */
  async start(): Promise<void> {
    // DISABLED: STT handled by alwaysListen singleton
    console.log('[STTService] 🔴 start() DISABLED - handled by alwaysListen');
    return; // Exit early
  }

  /**
   * Stop STT service - DISABLED
   */
  stop(): void {
    console.log('[STTService] 🔴 stop() DISABLED - handled by alwaysListen');
    return; // Exit early
  }

  /**
   * Start recognition - DISABLED
   */
  private startRecognition(): void {
    console.log('[STTService] 🔴 startRecognition() DISABLED - handled by alwaysListen');
    return; // Exit early
  }

  /**
   * Stop recognition - DISABLED
   */
  private stopRecognition(): void {
    console.log('[STTService] 🔴 stopRecognition() DISABLED - handled by alwaysListen');
    return; // Exit early
  }

  /**
   * Restart recognition
   */
  private restart(): void {
    if (!this.isEnabled) return;
    
    this.stopRecognition();
    setTimeout(() => {
      if (this.isEnabled && !Voice.isSpeaking()) {
        this.startRecognition();
      }
    }, 100);
  }

  /**
   * Pause STT when TTS is speaking - DISABLED
   */
  pauseForTTS(): void {
    console.log('[STTService] 🔴 pauseForTTS() DISABLED - handled by alwaysListen');
    return; // Exit early
  }

  /**
   * Resume STT after TTS completes - DISABLED
   */
  resumeAfterTTS(): void {
    console.log('[STTService] 🔴 resumeAfterTTS() DISABLED - handled by alwaysListen');
    return; // Exit early
  }

  /**
   * Start silence timer
   */
  private startSilenceTimer(): void {
    // Don't restart on silence if permission is denied
    if (!this.permissionGranted) {
      return;
    }
    
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      console.log('[STTService] Silence timeout, restarting recognition');
      // Only restart if permission is still granted
      if (this.isEnabled && !Voice.isSpeaking() && this.permissionGranted) {
        this.restart();
      }
    }, 3000); // 3 seconds of silence
  }

  /**
   * Reset silence timer
   */
  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
  }

  /**
   * Clear silence timer
   */
  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isEnabled: boolean;
    isListening: boolean;
    permissionGranted: boolean;
    language: string;
    lastTranscript: string;
  } {
    return {
      isEnabled: this.isEnabled,
      isListening: this.isListening,
      permissionGranted: this.permissionGranted,
      language: this.language,
      lastTranscript: this.lastTranscript,
    };
  }

  /**
   * Set language
   */
  setLanguage(language: string): void {
    this.language = language;
    this.recognition.lang = language;
    
    if (this.isListening) {
      this.restart();
    }
  }
}

// Export singleton instance
export const sttService = new STTService();