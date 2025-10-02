/**
 * Voice Controller Module
 * Coordinates STT and TTS states to prevent feedback loops
 */

import { sttService } from './stt/sttService';
import { wakeWordDetector } from './wakeWord';
import { voiceOrchestrator } from './tts/orchestrator';
import { voiceBus } from './voiceBus';
import { Voice } from '../lib/voiceController';

export type VoiceMode = 'WAKE' | 'ACTIVE' | 'MUTED';

export interface VoiceControllerConfig {
  autoStart?: boolean;
  wakeWordEnabled?: boolean;
  mode?: VoiceMode;
}

class VoiceControllerModule {
  private isInitialized: boolean = false;
  private mode: VoiceMode = 'WAKE';
  private wakeWordEnabled: boolean = true;
  private sttEnabled: boolean = false;
  private ttsActive: boolean = false;
  private unsubscribeHandlers: Array<() => void> = [];

  constructor() {
    console.log('[VoiceController] Module initialized');
  }

  /**
   * Initialize the voice controller
   */
  async initialize(config?: VoiceControllerConfig): Promise<void> {
    if (this.isInitialized) {
      console.log('[VoiceController] Already initialized');
      return;
    }

    console.log('[VoiceController] Initializing voice controller...');

    // Set initial mode
    this.mode = config?.mode || 'WAKE';
    this.wakeWordEnabled = config?.wakeWordEnabled !== false;

    // Setup event listeners
    this.setupEventListeners();

    // Request microphone permissions
    try {
      const permitted = await sttService.requestPermissions();
      if (!permitted) {
        console.error('[VoiceController] Microphone permission denied');
        throw new Error('Microphone permission required for voice features');
      }
    } catch (error) {
      console.error('[VoiceController] Failed to get microphone permissions:', error);
      throw error;
    }

    // Start STT service
    if (config?.autoStart !== false) {
      await this.startSTT();
    }

    // Enable wake word if requested
    if (this.wakeWordEnabled) {
      wakeWordDetector.enable();
    }

    this.isInitialized = true;
    console.log('[VoiceController] Initialization complete');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for TTS speaking events
    const unsubSpeak = voiceBus.on('speak', (event) => {
      console.log('[VoiceController] TTS speak event received');
      this.handleTTSStart();
    });
    this.unsubscribeHandlers.push(unsubSpeak);

    // Listen for TTS completion (speaking change)
    const unsubSpeaking = voiceBus.on('speakingChange', (event) => {
      if (!event.speaking) {
        console.log('[VoiceController] TTS completed');
        this.handleTTSComplete();
      }
    });
    this.unsubscribeHandlers.push(unsubSpeaking);

    // Listen for mode changes from Voice controller
    const unsubMode = Voice.subscribe((state) => {
      if (state.mode === 'WAKE' || state.mode === 'ACTIVE') {
        this.mode = state.mode as VoiceMode;
      } else if (state.mode === 'MUTED') {
        this.mode = 'MUTED';
      }
    });
    this.unsubscribeHandlers.push(unsubMode);

    // Listen for user speech to process
    const unsubSpeech = voiceBus.on('userSpeechRecognized', (event) => {
      if (event.text) {
        this.handleUserSpeech(event.text);
      }
    });
    this.unsubscribeHandlers.push(unsubSpeech);
  }

  /**
   * Handle TTS start - pause STT to prevent feedback
   */
  private handleTTSStart(): void {
    console.log('[VoiceController] TTS starting, pausing STT');
    this.ttsActive = true;
    
    // Notify Voice controller that we're speaking
    Voice.speaking(true);
    
    // Pause STT to prevent self-listening
    sttService.pauseForTTS();
  }

  /**
   * Handle TTS complete - resume STT
   */
  private handleTTSComplete(): void {
    console.log('[VoiceController] TTS completed, resuming STT');
    this.ttsActive = false;
    
    // Notify Voice controller that we're done speaking
    Voice.speaking(false);
    
    // Resume STT after a short delay
    setTimeout(() => {
      if (!this.ttsActive) {
        sttService.resumeAfterTTS();
      }
    }, 300);
  }

  /**
   * Handle user speech input
   */
  private handleUserSpeech(text: string): void {
    // In WAKE mode, check for wake word
    if (this.mode === 'WAKE' && this.wakeWordEnabled) {
      const lowercaseText = text.toLowerCase();
      if (lowercaseText.includes('chango') || 
          lowercaseText.includes('hey chango') ||
          lowercaseText.includes('hi chango')) {
        console.log('[VoiceController] Wake word detected, activating');
        Voice.wakeWordHeard();
        return;
      }
      // Don't process other speech in WAKE mode
      console.log('[VoiceController] In WAKE mode, ignoring non-wake-word speech');
      return;
    }

    // In ACTIVE mode or when wake window is open, process the speech
    if (this.mode === 'ACTIVE' || Voice.getMode() === 'ACTIVE') {
      console.log('[VoiceController] Processing user speech in ACTIVE mode:', text);
      // The conversation engine will handle this via the voiceBus event
    }
  }

  /**
   * Start STT service
   */
  async startSTT(): Promise<void> {
    if (this.sttEnabled) {
      console.log('[VoiceController] STT already enabled');
      return;
    }

    console.log('[VoiceController] Starting STT service');
    await sttService.start();
    this.sttEnabled = true;
  }

  /**
   * Stop STT service
   */
  stopSTT(): void {
    if (!this.sttEnabled) {
      console.log('[VoiceController] STT already disabled');
      return;
    }

    console.log('[VoiceController] Stopping STT service');
    sttService.stop();
    this.sttEnabled = false;
  }

  /**
   * Set voice mode
   */
  setMode(mode: VoiceMode): void {
    console.log(`[VoiceController] Setting mode to ${mode}`);
    this.mode = mode;

    // Update Voice controller
    Voice.setMode(mode === 'MUTED' ? 'MUTED' : mode === 'WAKE' ? 'WAKE' : 'ACTIVE');

    // Handle mode-specific actions
    if (mode === 'MUTED') {
      this.stopSTT();
      wakeWordDetector.disable();
    } else {
      this.startSTT().catch(err => {
        console.error('[VoiceController] Failed to start STT:', err);
      });
      
      if (mode === 'WAKE' && this.wakeWordEnabled) {
        wakeWordDetector.enable();
      }
    }
  }

  /**
   * Enable wake word detection
   */
  enableWakeWord(): void {
    console.log('[VoiceController] Enabling wake word detection');
    this.wakeWordEnabled = true;
    wakeWordDetector.enable();
  }

  /**
   * Disable wake word detection
   */
  disableWakeWord(): void {
    console.log('[VoiceController] Disabling wake word detection');
    this.wakeWordEnabled = false;
    wakeWordDetector.disable();
  }

  /**
   * Check if TTS is currently speaking
   */
  isSpeaking(): boolean {
    return this.ttsActive || voiceOrchestrator.isSpeaking();
  }

  /**
   * Get current status
   */
  getStatus(): {
    isInitialized: boolean;
    mode: VoiceMode;
    sttEnabled: boolean;
    ttsActive: boolean;
    wakeWordEnabled: boolean;
    sttStatus: any;
    wakeWordStatus: any;
  } {
    return {
      isInitialized: this.isInitialized,
      mode: this.mode,
      sttEnabled: this.sttEnabled,
      ttsActive: this.ttsActive,
      wakeWordEnabled: this.wakeWordEnabled,
      sttStatus: sttService.getStatus(),
      wakeWordStatus: wakeWordDetector.getStatus()
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    console.log('[VoiceController] Destroying voice controller');
    
    // Stop services
    this.stopSTT();
    wakeWordDetector.disable();
    
    // Unsubscribe from events
    this.unsubscribeHandlers.forEach(unsub => unsub());
    this.unsubscribeHandlers = [];
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const voiceController = new VoiceControllerModule();