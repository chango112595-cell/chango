/**
 * TTS System Interfaces
 * Defines contracts for the Text-To-Speech system
 */

/**
 * Voice profile configuration
 */
export interface VoiceProfile {
  id: string;
  name: string;
  pitch?: number;      // 0-2, default 1
  rate?: number;       // 0.1-10, default 1
  volume?: number;     // 0-1, default 1
  voice?: string;      // Voice name/URI for the provider
  locale?: string;     // Language locale (e.g., 'en-US')
  type?: 'neural' | 'standard' | 'custom';
  properties?: Record<string, any>; // Provider-specific properties
}

/**
 * Options for TTS speak operations
 */
export interface TTSSpeakOptions {
  profile?: string;    // Profile ID to use
  pitch?: number;      // Override profile pitch
  rate?: number;       // Override profile rate  
  volume?: number;     // Override profile volume
  voice?: string;      // Override profile voice
  locale?: string;     // Override profile locale
  priority?: 'low' | 'normal' | 'high';
  interrupt?: boolean; // Whether to interrupt current speech
  callback?: () => void; // Called when speech completes
}

/**
 * Base interface for TTS providers
 */
export interface TTSProvider {
  /**
   * Provider identifier
   */
  readonly id: string;
  
  /**
   * Human-readable name
   */
  readonly name: string;
  
  /**
   * Check if the provider is available in this environment
   */
  isAvailable(): boolean;
  
  /**
   * Speak the given text with the specified options
   * @returns Promise that resolves when speech completes
   */
  speak(text: string, options?: TTSSpeakOptions): Promise<void>;
  
  /**
   * Stop any ongoing speech
   */
  stop(): void;
  
  /**
   * Get available voices from this provider
   */
  getVoices?(): Promise<string[]>;
  
  /**
   * Check if provider is currently speaking
   */
  isSpeaking?(): boolean;
  
  /**
   * Pause current speech (if supported)
   */
  pause?(): void;
  
  /**
   * Resume paused speech (if supported)
   */
  resume?(): void;
}