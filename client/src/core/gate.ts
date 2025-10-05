/**
 * Voice Gate Module
 * Controls whether voice responses are allowed to proceed
 * Independent of text chat to ensure typed messages always work
 */

import { debugBus } from '../dev/debugBus';
import { queryMicPermission } from './permissions';

export class VoiceGate {
  private isOpen = false;
  private permissionGranted = false;
  private listeners: Array<(state: boolean) => void> = [];
  
  constructor() {
    // Check initial permission state
    this.checkPermission();
    
    // Subscribe to gate state changes for debug monitoring
    this.onStateChange((isOpen) => {
      const status = this.getStatus();
      debugBus.info('Gate', isOpen ? 'open' : 'closed', {
        hasPermission: status.hasPermission,
        canPassVoice: status.canPassVoice
      });
    });
  }

  /**
   * Open the gate to allow voice responses
   */
  async open(source: string = 'manual'): Promise<boolean> {
    debugBus.info('Gate', 'open_attempt', { source, wasOpen: this.isOpen });
    
    // Check permission first
    await this.checkPermission();
    
    if (!this.permissionGranted) {
      debugBus.warn('Gate', 'open_blocked', { reason: 'no_permission' });
      return false;
    }
    
    this.isOpen = true;
    this.notifyListeners();
    
    debugBus.info('Gate', 'opened', { source });
    return true;
  }

  /**
   * Close the gate to block voice responses
   */
  close(reason: string = 'manual'): void {
    const wasOpen = this.isOpen;
    this.isOpen = false;
    this.notifyListeners();
    
    debugBus.info('Gate', 'closed', { reason, wasOpen });
  }

  /**
   * Check if the gate is currently open
   */
  isGateOpen(): boolean {
    return this.isOpen && this.permissionGranted;
  }

  /**
   * Check if permission is granted
   */
  hasPermission(): boolean {
    return this.permissionGranted;
  }

  /**
   * Check and update permission state
   */
  async checkPermission(): Promise<boolean> {
    const status = await queryMicPermission();
    this.permissionGranted = status.granted;
    
    debugBus.info('Gate', 'permission_check', { 
      granted: this.permissionGranted,
      state: status.state 
    });
    
    // If permission was revoked, close the gate
    if (!this.permissionGranted && this.isOpen) {
      this.close('permission_revoked');
    }
    
    return this.permissionGranted;
  }

  /**
   * Subscribe to gate state changes
   */
  onStateChange(listener: (isOpen: boolean) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current gate status
   */
  getStatus() {
    return {
      isOpen: this.isOpen,
      hasPermission: this.permissionGranted,
      canPassVoice: this.isGateOpen(),
      canPassText: true // Text always passes
    };
  }

  /**
   * Check if a message can pass through the gate
   * @param type - 'voice' or 'text'
   */
  canPass(type: 'voice' | 'text'): boolean {
    // Text messages always pass
    if (type === 'text') {
      debugBus.info('Gate', 'pass', { type: 'text', allowed: true });
      return true;
    }
    
    // Voice messages need gate open and permission
    const canPassVoice = this.isGateOpen();
    debugBus.info('Gate', 'pass', { 
      type: 'voice', 
      allowed: canPassVoice,
      isOpen: this.isOpen,
      hasPermission: this.permissionGranted 
    });
    
    return canPassVoice;
  }

  /**
   * Reset the gate to initial state
   */
  reset(): void {
    this.isOpen = false;
    this.permissionGranted = false;
    this.notifyListeners();
    
    debugBus.info('Gate', 'reset', {});
  }

  private notifyListeners(): void {
    const state = this.isGateOpen();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[Gate] Error in state change listener:', error);
      }
    });
  }
}

// Singleton instance
export const voiceGate = new VoiceGate();

// Export convenience functions
export const openGate = (source?: string) => voiceGate.open(source);
export const closeGate = (reason?: string) => voiceGate.close(reason);
export const isGateOpen = () => voiceGate.isGateOpen();
export const canPassGate = (type: 'voice' | 'text') => voiceGate.canPass(type);