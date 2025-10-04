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
    // Check for browser support
    const windowWithSpeech = window as any as WindowWithSpeechRecognition;
    const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('[STTService] Web Speech API not supported in this browser');
      throw new Error('Web Speech API not supported');
    }

    // Create recognition instance
    this.recognition = new SpeechRecognition();
    this.setupRecognition();
    
    console.log('[STTService] Service initialized');
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
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    // Check if permission was already denied and stored
    if (sessionStorage.getItem('mic_permission_denied') === 'true') {
      console.log('[STTService] 🚫 Permission previously denied, not requesting again');
      this.permissionGranted = false;
      return false;
    }
    
    // Check if permission was already granted
    if (sessionStorage.getItem('mic_permission_granted') === 'true') {
      console.log('[STTService] ✅ Permission already granted');
      this.permissionGranted = true;
      return true;
    }
    
    try {
      console.log('[STTService] 🎤 Requesting microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      this.permissionGranted = true;
      sessionStorage.setItem('mic_permission_granted', 'true');
      sessionStorage.removeItem('mic_permission_denied');
      
      console.log('[STTService] ✅ Microphone permission GRANTED! Ready to listen.');
      console.log('[STTService] 📊 Permission status:', { 
        permissionGranted: this.permissionGranted, 
        isEnabled: this.isEnabled,
        isListening: this.isListening 
      });
      
      return true;
    } catch (error: any) {
      console.error('[STTService] ❌ Microphone permission DENIED:', error);
      this.permissionGranted = false;
      
      // Store the denial persistently to avoid retry loops
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        sessionStorage.setItem('mic_permission_denied', 'true');
        sessionStorage.setItem('mic_permission_granted', 'false');
      }
      
      return false;
    }
  }

  /**
   * Start STT service
   */
  async start(): Promise<void> {
    if (this.isEnabled) {
      console.log('[STTService] Already enabled');
      // Make sure we're actually listening
      if (!this.isListening && !Voice.isSpeaking()) {
        console.log('[STTService] 🔄 Service enabled but not listening, starting recognition...');
        this.startRecognition();
      }
      return;
    }

    // Request permissions if not granted
    if (!this.permissionGranted) {
      console.log('[STTService] 🎤 Permissions not yet granted, requesting...');
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Microphone permission denied');
      }
    }

    console.log('[STTService] 🚀 Starting STT service');
    this.isEnabled = true;
    this.autoRestart = true;
    
    // Start recognition if not speaking
    if (!Voice.isSpeaking()) {
      console.log('[STTService] 🎧 Starting recognition (not speaking)');
      this.startRecognition();
    } else {
      console.log('[STTService] ⏸️ Delaying recognition start (TTS is speaking)');
    }
  }

  /**
   * Stop STT service
   */
  stop(): void {
    console.log('[STTService] Stopping service');
    this.isEnabled = false;
    this.autoRestart = false;
    this.stopRecognition();
    this.clearSilenceTimer();
  }

  /**
   * Start recognition
   */
  private startRecognition(): void {
    if (this.isListening) {
      console.log('[STTService] ✅ Already listening');
      return;
    }

    try {
      console.log('[STTService] 🎤 Starting recognition...');
      this.recognition.start();
      this.isListening = true;
      console.log('[STTService] ✅ Recognition start() called successfully');
    } catch (error: any) {
      console.error('[STTService] ❌ Failed to start recognition:', error);
      
      // Handle the case where recognition is already started
      if (error.message && error.message.includes('already started')) {
        console.log('[STTService] ⚠️ Recognition was already started, stopping and restarting');
        this.stopRecognition();
        setTimeout(() => this.startRecognition(), 100);
      }
    }
  }

  /**
   * Stop recognition
   */
  private stopRecognition(): void {
    if (!this.isListening) {
      console.log('[STTService] Not currently listening');
      return;
    }

    try {
      console.log('[STTService] Stopping recognition');
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('[STTService] Failed to stop recognition:', error);
    }
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
   * Pause STT when TTS is speaking
   */
  pauseForTTS(): void {
    console.log('[STTService] Pausing for TTS');
    this.stopRecognition();
  }

  /**
   * Resume STT after TTS completes
   */
  resumeAfterTTS(): void {
    console.log('[STTService] Resuming after TTS');
    if (this.isEnabled && !this.isListening) {
      // Wait a bit to avoid capturing tail of TTS
      setTimeout(() => {
        if (this.isEnabled && !Voice.isSpeaking()) {
          this.startRecognition();
        }
      }, 300);
    }
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