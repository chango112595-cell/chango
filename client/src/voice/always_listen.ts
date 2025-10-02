/**
 * Always Listen Module
 * Implements continuous listening with auto-restart
 * No wake word required - always listening
 */

import { voiceBus } from './voiceBus';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';
import { beat } from '../dev/health/monitor';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  readonly message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

// Extend Window interface to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export interface AlwaysListenConfig {
  autoRestart?: boolean;
  pauseOnHidden?: boolean;
  silenceTimeout?: number; // ms of silence before restarting
}

class AlwaysListenManager {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private isEnabled: boolean = false;
  private hasPermission: boolean = false;
  private config: AlwaysListenConfig;
  private restartTimer: NodeJS.Timeout | null = null;
  private finalTranscript: string = '';
  private lastInterimTranscript: string = '';
  private hasReceivedFinalResult: boolean = false;

  constructor() {
    this.config = {
      autoRestart: true,
      pauseOnHidden: true,
      silenceTimeout: 2000 // 2 seconds of silence before restarting
    };

    // Setup visibility change handler
    if (this.config.pauseOnHidden) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  /**
   * Initialize continuous listening
   */
  async initialize(): Promise<void> {
    console.log('[STT] init');
    console.log('[AlwaysListen] Initializing continuous listening...');
    
    // Log to debug bus
    if (FEATURES.DEBUG_BUS) {
      debugBus.info('STT', 'init', { module: 'AlwaysListen' });
    }
    
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    // Create recognition instance
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // Keep listening
    this.recognition.interimResults = true; // Get partial results
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('[AlwaysListen] Speech recognition initialized');
  }

  /**
   * Request microphone permission and start listening
   */
  async start(): Promise<void> {
    if (!this.recognition) {
      await this.initialize();
    }

    if (this.isListening) {
      console.log('[AlwaysListen] Already listening');
      return;
    }

    try {
      console.log('[AlwaysListen] Requesting microphone permission...');
      
      // Request permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
      
      this.hasPermission = true;
      this.isEnabled = true;
      
      console.log('[AlwaysListen] Microphone permission granted');
      console.log('[AlwaysListen] Starting continuous listening...');
      
      this.startRecognition();
    } catch (error) {
      console.error('[AlwaysListen] Failed to get microphone permission:', error);
      this.hasPermission = false;
      throw error;
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    console.log('[AlwaysListen] Stopping continuous listening...');
    
    this.isEnabled = false;
    this.isListening = false;
    
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Setup speech recognition event handlers
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    // Handle recognition start
    this.recognition.onstart = () => {
      console.log('[AlwaysListen] 🎤 Recognition started');
      this.isListening = true;
    };

    // Handle recognition end
    this.recognition.onend = () => {
      console.log('[STT] end → restart');
      console.log('[AlwaysListen] 🔴 Recognition ended');
      
      // Log to debug bus
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('STT', 'end', { willRestart: this.isEnabled && this.config.autoRestart });
      }
      
      this.isListening = false;
      
      // Auto-restart if enabled and not manually stopped
      if (this.isEnabled && this.config.autoRestart) {
        console.log('[AlwaysListen] Auto-restarting in 500ms...');
        this.restartTimer = setTimeout(() => {
          if (this.isEnabled) {
            this.startRecognition();
          }
        }, 500);
      }
    };

    // Handle recognition results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('[AlwaysListen] 📝 Processing recognition results...');
      console.log(`[AlwaysListen] Result index: ${event.resultIndex}, Total results: ${event.results.length}`);
      
      // Send STT heartbeat
      try {
        beat('stt', { hasResults: true });
      } catch (error) {
        console.error('[AlwaysListen] Error sending heartbeat:', error);
      }
      
      let interimTranscript = '';
      let finalTranscript = '';
      
      // Process all results from the current event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        
        console.log(`[AlwaysListen] Result[${i}] - isFinal: ${result.isFinal}, transcript: "${transcript}"`);
        
        if (result.isFinal) {
          // This is a final result
          finalTranscript = transcript;
          this.hasReceivedFinalResult = true;
          console.log('[AlwaysListen] ✅ Final result detected:', finalTranscript);
          
          if (finalTranscript && finalTranscript.length > 0) {
            console.log('[STT] heard:', finalTranscript);
            console.log('[AlwaysListen] 🚀 Emitting final transcript to voiceBus:', finalTranscript);
            
            // Log to debug bus
            if (FEATURES.DEBUG_BUS) {
              debugBus.info('STT', 'heard', { text: finalTranscript });
            }
            
            // CRITICAL: Emit the final speech to voiceBus for processing
            try {
              // Get current state
              const state = voiceBus.getState();
              
              // Emit with full event structure
              voiceBus.emit({
                type: 'userSpeechRecognized',
                text: finalTranscript,
                source: 'user',
                state: state
              });
              console.log('[AlwaysListen] ✓ Successfully emitted to voiceBus');
              
              // Clear the last interim transcript since we've processed a final result
              this.lastInterimTranscript = '';
            } catch (error) {
              console.error('[AlwaysListen] ❌ Failed to emit to voiceBus:', error);
            }
            
            // Give a small delay before restarting to avoid interrupting processing
            if (this.config.autoRestart) {
              console.log('[AlwaysListen] Will restart recognition in 1 second...');
              setTimeout(() => {
                if (this.isEnabled) {
                  this.restartRecognition();
                }
              }, 1000);
            }
          } else {
            console.log('[AlwaysListen] ⚠️ Final result was empty, ignoring');
          }
        } else {
          // This is an interim result
          interimTranscript += transcript + ' ';
          // Store the last interim transcript
          this.lastInterimTranscript = transcript;
        }
      }
      
      // Log interim results if any
      if (interimTranscript.trim()) {
        console.log('[AlwaysListen] 💬 Interim transcript:', interimTranscript.trim());
      }
    };

    // Handle recognition errors
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[STT] error', event.error);
      console.error('[AlwaysListen] Recognition error:', event.error);
      
      // Log to debug bus
      if (FEATURES.DEBUG_BUS) {
        debugBus.error('STT', 'error', { 
          error: event.error, 
          message: event.message 
        });
      }
      
      if (event.error === 'not-allowed') {
        this.hasPermission = false;
        this.isEnabled = false;
        console.error('[AlwaysListen] Microphone permission denied');
      } else if (event.error === 'no-speech') {
        // Silence detected - restart
        if (this.isEnabled && this.config.autoRestart) {
          console.log('[AlwaysListen] No speech detected, restarting...');
          this.restartRecognition();
        }
      } else if (event.error === 'audio-capture') {
        console.error('[AlwaysListen] No microphone found');
        this.isEnabled = false;
      } else if (event.error === 'aborted') {
        // Recognition was aborted, will auto-restart if enabled
        console.log('[AlwaysListen] Recognition aborted');
      }
    };

    // Handle speech start/end
    this.recognition.onspeechstart = () => {
      console.log('[AlwaysListen] 🗣️ Speech detected');
      // Reset the flag when new speech starts
      this.hasReceivedFinalResult = false;
    };

    this.recognition.onspeechend = () => {
      console.log('[AlwaysListen] 🤐 Speech ended');
      
      // CRITICAL FIX: If speech ended without a final result, emit the last interim transcript
      if (!this.hasReceivedFinalResult && this.lastInterimTranscript && this.lastInterimTranscript.trim().length > 0) {
        const text = this.lastInterimTranscript.trim();
        console.log('[STT] heard:', text);
        console.log('[AlwaysListen] ⚡ No final result received, emitting last interim transcript:', text);
        
        try {
          // Get current state
          const state = voiceBus.getState();
          
          // Emit with full event structure
          voiceBus.emit({
            type: 'userSpeechRecognized',
            text: text,
            source: 'user',
            state: state
          });
          console.log('[AlwaysListen] ✓ Successfully emitted interim transcript as final result');
        } catch (error) {
          console.error('[AlwaysListen] ❌ Failed to emit interim transcript:', error);
        }
        
        // Clear the interim transcript after emitting
        this.lastInterimTranscript = '';
      }
    };
  }

  /**
   * Start speech recognition
   */
  private startRecognition(): void {
    if (!this.recognition || this.isListening) return;
    
    try {
      this.recognition.start();
      console.log('[AlwaysListen] Recognition started successfully');
    } catch (error) {
      console.error('[AlwaysListen] Failed to start recognition:', error);
      
      // Retry after a delay
      if (this.isEnabled) {
        setTimeout(() => {
          if (this.isEnabled) {
            this.startRecognition();
          }
        }, 1000);
      }
    }
  }

  /**
   * Restart recognition
   */
  private restartRecognition(): void {
    if (!this.isEnabled) return;
    
    console.log('[AlwaysListen] Restarting recognition...');
    
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    
    // Small delay before restarting
    setTimeout(() => {
      if (this.isEnabled) {
        this.startRecognition();
      }
    }, 300);
  }

  /**
   * Handle tab visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('[AlwaysListen] Tab hidden - pausing recognition');
      if (this.isListening) {
        this.recognition?.stop();
      }
    } else {
      console.log('[AlwaysListen] Tab visible - resuming recognition');
      if (this.isEnabled && !this.isListening) {
        this.startRecognition();
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    isEnabled: boolean;
    isListening: boolean;
    hasPermission: boolean;
  } {
    return {
      isEnabled: this.isEnabled,
      isListening: this.isListening,
      hasPermission: this.hasPermission
    };
  }

  /**
   * Configure always listen
   */
  configure(config: Partial<AlwaysListenConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[AlwaysListen] Configuration updated:', this.config);
  }
}

// Export singleton instance
export const alwaysListen = new AlwaysListenManager();