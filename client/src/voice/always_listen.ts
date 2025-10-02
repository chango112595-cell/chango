/**
 * Always Listen Module
 * Implements continuous listening with auto-restart
 * No wake word required - always listening
 */

import { voiceBus } from './voiceBus';

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
    console.log('[AlwaysListen] Initializing continuous listening...');
    
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
      console.log('[AlwaysListen] 🔴 Recognition ended');
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
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          this.finalTranscript = transcript.trim();
          
          if (this.finalTranscript) {
            console.log('[AlwaysListen] ✅ Final transcript:', this.finalTranscript);
            
            // Emit to voice bus
            voiceBus.emitUserSpeech(this.finalTranscript);
            
            // Reset final transcript
            this.finalTranscript = '';
            
            // Restart recognition after processing
            if (this.config.autoRestart) {
              this.restartRecognition();
            }
          }
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (interimTranscript) {
        console.log('[AlwaysListen] 💬 Interim:', interimTranscript);
      }
    };

    // Handle recognition errors
    this.recognition.onerror = (event) => {
      console.error('[AlwaysListen] Recognition error:', event.error);
      
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
    };

    this.recognition.onspeechend = () => {
      console.log('[AlwaysListen] 🤐 Speech ended');
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