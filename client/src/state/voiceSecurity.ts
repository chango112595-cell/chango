/**
 * Voice Security State Management
 * Handles voiceprint storage and security settings using localStorage
 */

import { VoiceprintData } from '../voice/security/voiceprint';

export interface VoiceSecuritySettings {
  requireMatch: boolean;
  matchThreshold: number;
  autoIdleTimeout: number;
  bargeInEnabled: boolean;
  vadEnabled: boolean;
}

export interface VoiceSecurityState {
  voiceprints: VoiceprintData[];
  activeVoiceprintId: string | null;
  settings: VoiceSecuritySettings;
  lastVerification: {
    timestamp: number;
    success: boolean;
    similarity?: number;
  } | null;
}

const STORAGE_KEY = 'voice_security_state';
const DEFAULT_SETTINGS: VoiceSecuritySettings = {
  requireMatch: false,
  matchThreshold: 0.85,
  autoIdleTimeout: 1000, // 1 second
  bargeInEnabled: true,
  vadEnabled: true
};

class VoiceSecurityStore {
  private state: VoiceSecurityState;
  private listeners: Set<(state: VoiceSecurityState) => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  /**
   * Load state from localStorage
   */
  private loadState(): VoiceSecurityState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle missing fields
        return {
          voiceprints: parsed.voiceprints || [],
          activeVoiceprintId: parsed.activeVoiceprintId || null,
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          lastVerification: parsed.lastVerification || null
        };
      }
    } catch (error) {
      console.error('[VoiceSecurity] Failed to load state:', error);
    }

    return {
      voiceprints: [],
      activeVoiceprintId: null,
      settings: DEFAULT_SETTINGS,
      lastVerification: null
    };
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (error) {
      console.error('[VoiceSecurity] Failed to save state:', error);
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: VoiceSecurityState) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const stateCopy = this.getState();
    this.listeners.forEach(listener => listener(stateCopy));
  }

  /**
   * Get current state (copy)
   */
  getState(): VoiceSecurityState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Add or update voiceprint
   */
  addVoiceprint(voiceprint: VoiceprintData): void {
    // Remove existing voiceprint with same ID if any
    this.state.voiceprints = this.state.voiceprints.filter(vp => vp.id !== voiceprint.id);
    
    // Add new voiceprint
    this.state.voiceprints.push(voiceprint);
    
    // Set as active if it's the only one
    if (this.state.voiceprints.length === 1) {
      this.state.activeVoiceprintId = voiceprint.id;
    }
    
    this.saveState();
    console.log('[VoiceSecurity] Added voiceprint:', voiceprint.id);
  }

  /**
   * Remove voiceprint
   */
  removeVoiceprint(voiceprintId: string): void {
    this.state.voiceprints = this.state.voiceprints.filter(vp => vp.id !== voiceprintId);
    
    // Clear active if it was removed
    if (this.state.activeVoiceprintId === voiceprintId) {
      this.state.activeVoiceprintId = this.state.voiceprints.length > 0 
        ? this.state.voiceprints[0].id 
        : null;
    }
    
    this.saveState();
    console.log('[VoiceSecurity] Removed voiceprint:', voiceprintId);
  }

  /**
   * Set active voiceprint
   */
  setActiveVoiceprint(voiceprintId: string | null): void {
    if (voiceprintId && !this.state.voiceprints.find(vp => vp.id === voiceprintId)) {
      console.error('[VoiceSecurity] Voiceprint not found:', voiceprintId);
      return;
    }
    
    this.state.activeVoiceprintId = voiceprintId;
    this.saveState();
    console.log('[VoiceSecurity] Set active voiceprint:', voiceprintId);
  }

  /**
   * Get active voiceprint
   */
  getActiveVoiceprint(): VoiceprintData | null {
    if (!this.state.activeVoiceprintId) return null;
    return this.state.voiceprints.find(vp => vp.id === this.state.activeVoiceprintId) || null;
  }

  /**
   * Update security settings
   */
  updateSettings(settings: Partial<VoiceSecuritySettings>): void {
    this.state.settings = { ...this.state.settings, ...settings };
    this.saveState();
    console.log('[VoiceSecurity] Updated settings:', this.state.settings);
  }

  /**
   * Get security settings
   */
  getSettings(): VoiceSecuritySettings {
    return { ...this.state.settings };
  }

  /**
   * Record verification attempt
   */
  recordVerification(success: boolean, similarity?: number): void {
    this.state.lastVerification = {
      timestamp: Date.now(),
      success,
      similarity
    };
    this.saveState();
    console.log('[VoiceSecurity] Recorded verification:', this.state.lastVerification);
  }

  /**
   * Check if voice matching is required
   */
  isMatchRequired(): boolean {
    return this.state.settings.requireMatch && this.state.activeVoiceprintId !== null;
  }

  /**
   * Get last verification result
   */
  getLastVerification(): VoiceSecurityState['lastVerification'] {
    return this.state.lastVerification ? { ...this.state.lastVerification } : null;
  }

  /**
   * Clear all voiceprints
   */
  clearAllVoiceprints(): void {
    this.state.voiceprints = [];
    this.state.activeVoiceprintId = null;
    this.state.lastVerification = null;
    this.saveState();
    console.log('[VoiceSecurity] Cleared all voiceprints');
  }

  /**
   * Reset to default settings
   */
  resetSettings(): void {
    this.state.settings = { ...DEFAULT_SETTINGS };
    this.saveState();
    console.log('[VoiceSecurity] Reset to default settings');
  }

  /**
   * Export state for backup
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from backup
   */
  importState(stateJson: string): boolean {
    try {
      const imported = JSON.parse(stateJson);
      
      // Validate structure
      if (!imported.voiceprints || !imported.settings) {
        throw new Error('Invalid state structure');
      }
      
      this.state = {
        voiceprints: imported.voiceprints,
        activeVoiceprintId: imported.activeVoiceprintId || null,
        settings: { ...DEFAULT_SETTINGS, ...imported.settings },
        lastVerification: imported.lastVerification || null
      };
      
      this.saveState();
      console.log('[VoiceSecurity] Imported state successfully');
      return true;
    } catch (error) {
      console.error('[VoiceSecurity] Failed to import state:', error);
      return false;
    }
  }
}

// Export singleton instance
export const voiceSecurityStore = new VoiceSecurityStore();