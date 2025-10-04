/**
 * Voice Controller Module
 * Coordinates STT and TTS states to prevent feedback loops
 */

// DISABLED: sttService no longer used - STT handled by alwaysListen singleton
// import { sttService } from './stt/sttService';
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

    console.log('[VoiceController] 🚀 Initializing voice controller...');

    // Set initial mode
    this.mode = config?.mode || 'WAKE';
    this.wakeWordEnabled = config?.wakeWordEnabled !== false;

    // Setup event listeners
    this.setupEventListeners();

    // DISABLED: STT is now handled by alwaysListen singleton in bootstrap.ts
    // No longer requesting permissions or starting STT here
    console.log('[VoiceController] 🔴 STT initialization DISABLED - handled by alwaysListen singleton');
    
    // Force check if Voice thinks it's speaking when it shouldn't be
    const voiceThinksSpeaking = Voice.isSpeaking();
    const ttsActuallySpeaking = voiceOrchestrator.isSpeaking();
    
    console.log('[VoiceController] 🔍 Speaking check:', {
      voiceThinksSpeaking,
      ttsActuallySpeaking,
      ttsActive: this.ttsActive
    });
    
    // If Voice thinks it's speaking but TTS isn't, clear the flag
    if (voiceThinksSpeaking && !ttsActuallySpeaking) {
      console.log('[VoiceController] 🔧 Voice thinks it\'s speaking but TTS is not, clearing flag');
      this.ttsActive = false;
      Voice.speaking(false);
    }

    // Enable wake word if requested
    if (this.wakeWordEnabled) {
      console.log('[VoiceController] 👂 Enabling wake word detection');
      wakeWordDetector.enable();
    }

    this.isInitialized = true;
    console.log('[VoiceController] ✅ Initialization complete!');
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
    // Check if TTS is actually going to speak
    const actuallySpeeking = voiceOrchestrator.isSpeaking();
    console.log('[VoiceController] 🔊 TTS event received, actually speaking:', actuallySpeeking);
    
    if (actuallySpeeking) {
      console.log('[VoiceController] ⏸️ TTS active - STT handled by alwaysListen singleton');
      this.ttsActive = true;
      Voice.speaking(true);
      // DISABLED: STT pause/resume now handled by alwaysListen singleton
    } else {
      console.log('[VoiceController] ℹ️ TTS event received but not actually speaking (text-only mode)');
      // Don't set ttsActive if not actually speaking
    }
  }

  /**
   * Handle TTS complete - resume STT
   */
  private handleTTSComplete(): void {
    console.log('[VoiceController] 🔇 TTS completed');
    this.ttsActive = false;
    
    // Notify Voice controller that we're done speaking
    Voice.speaking(false);
    
    // DISABLED: STT resume now handled by alwaysListen singleton
    console.log('[VoiceController] 🎧 TTS complete - STT handled by alwaysListen singleton');
  }

  /**
   * Handle user speech input
   */
  private handleUserSpeech(text: string): void {
    console.log('[VoiceController] 🎤 User speech detected:', text);
    console.log('[VoiceController] 📊 Current state:', { 
      mode: this.mode, 
      wakeWordEnabled: this.wakeWordEnabled,
      voiceMode: Voice.getMode()
    });
    
    // In WAKE mode, check for wake word AT THE START of speech
    if (this.mode === 'WAKE' && this.wakeWordEnabled) {
      const lowercaseText = text.toLowerCase().trim();
      
      // Check if the transcript STARTS WITH the wake word (not includes)
      const startsWithWakeWord = 
        lowercaseText.startsWith('chango') ||
        lowercaseText.startsWith('hey chango') ||
        lowercaseText.startsWith('hi chango') ||
        lowercaseText.startsWith('ok chango') ||
        lowercaseText.startsWith('yo chango');
      
      if (startsWithWakeWord) {
        console.log('[VoiceController] 🎉 Wake word detected at start of speech! Activating...');
        Voice.wakeWordHeard();
        
        // Extract the command after the wake word for processing
        let command = lowercaseText;
        if (lowercaseText.startsWith('hey chango')) {
          command = lowercaseText.substring('hey chango'.length).trim();
        } else if (lowercaseText.startsWith('hi chango')) {
          command = lowercaseText.substring('hi chango'.length).trim();
        } else if (lowercaseText.startsWith('ok chango')) {
          command = lowercaseText.substring('ok chango'.length).trim();
        } else if (lowercaseText.startsWith('yo chango')) {
          command = lowercaseText.substring('yo chango'.length).trim();
        } else if (lowercaseText.startsWith('chango')) {
          command = lowercaseText.substring('chango'.length).trim();
        }
        
        // If there's a command after the wake word, emit it for processing
        if (command) {
          console.log('[VoiceController] Processing command after wake word:', command);
          voiceBus.emit({ type: 'userSpeechRecognized', text: command, source: 'stt' });
        }
        
        return;
      }
      // Don't process other speech in WAKE mode
      console.log('[VoiceController] 👂 In WAKE mode, waiting for wake word at start of speech...');
      return;
    }

    // In ACTIVE mode or when wake window is open, process the speech
    if (this.mode === 'ACTIVE' || Voice.getMode() === 'ACTIVE') {
      console.log('[VoiceController] 💬 Processing user speech in ACTIVE mode:', text);
      // The conversation engine will handle this via the voiceBus event
    }
  }

  /**
   * Start STT service - DISABLED
   * STT is now handled by alwaysListen singleton
   */
  async startSTT(): Promise<void> {
    console.log('[VoiceController] 🔴 startSTT DISABLED - handled by alwaysListen singleton');
    // DISABLED: STT is now handled by alwaysListen singleton
    this.sttEnabled = false; // Always false since we're not using sttService
  }

  /**
   * Stop STT service - DISABLED
   * STT is now handled by alwaysListen singleton
   */
  stopSTT(): void {
    console.log('[VoiceController] 🔴 stopSTT DISABLED - handled by alwaysListen singleton');
    // DISABLED: STT is now handled by alwaysListen singleton
    this.sttEnabled = false; // Always false since we're not using sttService
  }

  /**
   * Set voice mode
   */
  setMode(mode: VoiceMode): void {
    console.log(`[VoiceController] Setting mode to ${mode}`);
    this.mode = mode;

    // Update Voice controller
    Voice.setMode(mode === 'MUTED' ? 'MUTED' : mode === 'WAKE' ? 'WAKE' : 'ACTIVE');

    // Handle mode-specific actions (STT is handled by alwaysListen singleton)
    if (mode === 'MUTED') {
      // DISABLED: STT stop now handled by alwaysListen singleton
      wakeWordDetector.disable();
    } else {
      // DISABLED: STT start now handled by alwaysListen singleton
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
    sttStatus: string;
    wakeWordStatus: any;
  } {
    return {
      isInitialized: this.isInitialized,
      mode: this.mode,
      sttEnabled: false, // Always false since STT is handled by alwaysListen singleton
      ttsActive: this.ttsActive,
      wakeWordEnabled: this.wakeWordEnabled,
      sttStatus: 'Handled by alwaysListen singleton', // Informational message
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