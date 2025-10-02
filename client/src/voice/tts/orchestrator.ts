/**
 * Voice Orchestrator
 * Manages TTS providers and voice profiles for the application
 * Locked to local-only provider for 100% offline operation
 */

import { TTSProvider, VoiceProfile, TTSSpeakOptions } from './interfaces';

/**
 * Default Jarvis voice profile
 */
const JARVIS_PROFILE: VoiceProfile = {
  id: 'jarvis',
  name: 'Jarvis',
  type: 'neural',
  pitch: 0.9,
  rate: 1.0,
  volume: 0.9,
  locale: 'en-GB',
  voice: 'Google UK English Male', // Will fallback to best available
  properties: {
    style: 'professional',
    personality: 'helpful',
    tone: 'calm'
  }
};

/**
 * Voice Orchestrator Class
 * Manages a single local TTS provider for offline voice synthesis
 */
class VoiceOrchestrator {
  private localProvider: TTSProvider | null = null;
  private currentProfile: VoiceProfile = JARVIS_PROFILE;
  private isInitialized: boolean = false;
  private speakingQueue: Array<{ text: string; options?: TTSSpeakOptions }> = [];
  private isSpeakingFlag: boolean = false;

  constructor() {
    console.log('[VoiceOrchestrator] Initializing with local-only mode');
  }

  /**
   * Register the local TTS provider
   * Only accepts one provider - the local neural provider
   */
  registerLocal(provider: TTSProvider): void {
    if (!provider) {
      console.error('[VoiceOrchestrator] Cannot register null provider');
      return;
    }

    if (provider.id !== 'local-neural') {
      console.warn('[VoiceOrchestrator] Only local-neural provider is accepted, got:', provider.id);
      return;
    }

    if (!provider.isAvailable()) {
      console.error('[VoiceOrchestrator] Local provider is not available in this environment');
      return;
    }

    this.localProvider = provider;
    this.isInitialized = true;
    console.log('[VoiceOrchestrator] Local provider registered successfully:', provider.name);
  }

  /**
   * Check if the orchestrator is ready to speak
   */
  isReady(): boolean {
    return this.isInitialized && this.localProvider !== null && this.localProvider.isAvailable();
  }

  /**
   * Get the current voice profile
   */
  getProfile(): VoiceProfile {
    return { ...this.currentProfile };
  }

  /**
   * Set a custom voice profile (optional)
   */
  setProfile(profile: Partial<VoiceProfile>): void {
    this.currentProfile = {
      ...this.currentProfile,
      ...profile
    };
    console.log('[VoiceOrchestrator] Profile updated:', this.currentProfile.name);
  }

  /**
   * Speak the given text using the local provider
   */
  async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
    if (!text || text.trim().length === 0) {
      console.warn('[VoiceOrchestrator] Empty text provided to speak');
      return;
    }

    if (!this.isReady()) {
      console.error('[VoiceOrchestrator] Not ready to speak. Provider not initialized.');
      return;
    }

    // Merge options with current profile
    const speakOptions: TTSSpeakOptions = {
      ...options,
      profile: options?.profile || this.currentProfile.id,
      pitch: options?.pitch ?? this.currentProfile.pitch,
      rate: options?.rate ?? this.currentProfile.rate,
      volume: options?.volume ?? this.currentProfile.volume,
      voice: options?.voice ?? this.currentProfile.voice,
      locale: options?.locale ?? this.currentProfile.locale,
      interrupt: options?.interrupt ?? true
    };

    // Handle interruption
    if (speakOptions.interrupt && this.isSpeakingFlag) {
      this.stop();
      this.speakingQueue = [];
    }

    // Add to queue if already speaking and not interrupting
    if (this.isSpeakingFlag && !speakOptions.interrupt) {
      console.log('[VoiceOrchestrator] Queuing speech:', text.substring(0, 50) + '...');
      this.speakingQueue.push({ text, options: speakOptions });
      return;
    }

    try {
      this.isSpeakingFlag = true;
      console.log('[VoiceOrchestrator] Speaking:', text.substring(0, 50) + '...');
      
      await this.localProvider!.speak(text, speakOptions);
      
      // Execute callback if provided
      if (speakOptions.callback) {
        speakOptions.callback();
      }

      // Process queue if any
      await this.processQueue();
      
    } catch (error) {
      console.error('[VoiceOrchestrator] Speech error:', error);
    } finally {
      this.isSpeakingFlag = false;
    }
  }

  /**
   * Process queued speech
   */
  private async processQueue(): Promise<void> {
    if (this.speakingQueue.length === 0) {
      this.isSpeakingFlag = false;
      return;
    }

    const next = this.speakingQueue.shift();
    if (next) {
      await this.speak(next.text, next.options);
    }
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (!this.localProvider) {
      console.warn('[VoiceOrchestrator] No provider to stop');
      return;
    }

    console.log('[VoiceOrchestrator] Stopping speech');
    this.localProvider.stop();
    this.isSpeakingFlag = false;
    this.speakingQueue = [];
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    if (!this.localProvider) return false;
    
    if (this.localProvider.isSpeaking) {
      return this.localProvider.isSpeaking();
    }
    
    return this.isSpeakingFlag;
  }

  /**
   * Alias for isSpeaking (backward compatibility)
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking();
  }

  /**
   * Pause speech (if supported)
   */
  pause(): void {
    if (!this.localProvider) return;
    
    if (this.localProvider.pause) {
      console.log('[VoiceOrchestrator] Pausing speech');
      this.localProvider.pause();
    }
  }

  /**
   * Resume speech (if supported)
   */
  resume(): void {
    if (!this.localProvider) return;
    
    if (this.localProvider.resume) {
      console.log('[VoiceOrchestrator] Resuming speech');
      this.localProvider.resume();
    }
  }

  /**
   * Get available voices from the local provider
   */
  async getVoices(): Promise<string[]> {
    if (!this.localProvider || !this.localProvider.getVoices) {
      return [];
    }
    
    return await this.localProvider.getVoices();
  }

  /**
   * Reset to default Jarvis profile
   */
  resetProfile(): void {
    this.currentProfile = JARVIS_PROFILE;
    console.log('[VoiceOrchestrator] Profile reset to Jarvis');
  }
}

// Export singleton instance
export const voiceOrchestrator = new VoiceOrchestrator();

// Export class for testing
export { VoiceOrchestrator };