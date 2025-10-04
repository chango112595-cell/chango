/**
 * Voice Orchestrator Module
 * Manages voice and text routing, ensuring text always passes through
 */

import { voiceGate } from './gate';
import { voiceBus } from './voice-bus';
import { debugBus } from '../dev/debugBus';
import { ensureMicPermission } from './permissions';

export interface MessageInput {
  text: string;
  source: 'voice' | 'text' | 'system';
  metadata?: any;
}

export interface RouteDecision {
  shouldProcess: boolean;
  shouldRespond: boolean;
  responseType: 'voice' | 'text' | 'both' | 'none';
  reason?: string;
}

export class VoiceOrchestrator {
  private isProcessing = false;
  
  /**
   * Route a message through the system
   */
  async routeMessage(input: MessageInput): Promise<RouteDecision> {
    debugBus.info('Orchestrator', 'route_request', { 
      source: input.source, 
      textLength: input.text.length 
    });
    
    // Text messages ALWAYS route through
    if (input.source === 'text') {
      debugBus.info('Orchestrator', 'text_pass_through', { 
        gateOpen: voiceGate.isGateOpen() 
      });
      
      return {
        shouldProcess: true,
        shouldRespond: true,
        responseType: 'text', // Text input gets text response
        reason: 'text_always_passes'
      };
    }
    
    // System messages always route through
    if (input.source === 'system') {
      return {
        shouldProcess: true,
        shouldRespond: true,
        responseType: 'both',
        reason: 'system_priority'
      };
    }
    
    // Voice messages need gate check
    const canPassVoice = voiceGate.canPass('voice');
    
    if (!canPassVoice) {
      debugBus.warn('Orchestrator', 'voice_blocked', { 
        hasPermission: voiceGate.hasPermission(),
        gateOpen: voiceGate.isGateOpen()
      });
      
      return {
        shouldProcess: false,
        shouldRespond: false,
        responseType: 'none',
        reason: 'gate_closed'
      };
    }
    
    // Voice can pass
    debugBus.info('Orchestrator', 'voice_allowed', {});
    
    return {
      shouldProcess: true,
      shouldRespond: true,
      responseType: 'voice',
      reason: 'gate_open'
    };
  }
  
  /**
   * Process a message after routing decision
   */
  async processMessage(input: MessageInput, decision: RouteDecision): Promise<void> {
    if (!decision.shouldProcess) {
      debugBus.info('Orchestrator', 'message_rejected', { 
        reason: decision.reason 
      });
      return;
    }
    
    if (this.isProcessing) {
      debugBus.warn('Orchestrator', 'already_processing', {});
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Emit message event
      voiceBus.emit({
        type: 'message',
        source: input.source,
        data: {
          text: input.text,
          responseType: decision.responseType,
          metadata: input.metadata
        }
      });
      
      debugBus.info('Orchestrator', 'message_processed', { 
        source: input.source,
        responseType: decision.responseType 
      });
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Try to open the gate with user gesture
   */
  async tryOpenGate(): Promise<boolean> {
    debugBus.info('Orchestrator', 'gate_open_attempt', {});
    
    try {
      // First ensure we have permission (requires user gesture on iOS)
      const permStatus = await ensureMicPermission();
      
      if (!permStatus.granted) {
        debugBus.warn('Orchestrator', 'permission_denied', { 
          state: permStatus.state 
        });
        return false;
      }
      
      // Permission granted, open the gate
      const opened = await voiceGate.open('user_gesture');
      
      debugBus.info('Orchestrator', 'gate_open_result', { opened });
      
      return opened;
    } catch (error) {
      debugBus.error('Orchestrator', 'gate_open_error', { 
        error: String(error) 
      });
      return false;
    }
  }
  
  /**
   * Handle user interaction (tap/click/keypress)
   * This is the trigger point for iOS Safari permission
   */
  async handleUserGesture(type: 'tap' | 'click' | 'keypress'): Promise<void> {
    debugBus.info('Orchestrator', 'user_gesture', { type });
    
    // If gate is already open, nothing to do
    if (voiceGate.isGateOpen()) {
      debugBus.info('Orchestrator', 'gate_already_open', {});
      return;
    }
    
    // Try to open the gate (will request permission if needed)
    const opened = await this.tryOpenGate();
    
    if (opened) {
      // Gate opened successfully, emit event
      voiceBus.emit({
        type: 'gate_opened',
        source: 'user_gesture',
        data: { gestureType: type }
      });
      
      // Start listening if not already
      voiceBus.emit({
        type: 'start_listening',
        source: 'orchestrator'
      });
    }
  }
  
  /**
   * Cancel any ongoing processing
   */
  cancel(source: string = 'orchestrator'): void {
    debugBus.info('Orchestrator', 'cancel', { source });
    
    this.isProcessing = false;
    voiceBus.cancel(source);
  }
  
  /**
   * Get orchestrator status
   */
  getStatus() {
    const gateStatus = voiceGate.getStatus();
    
    return {
      isProcessing: this.isProcessing,
      gate: gateStatus,
      canProcessText: true, // Text always works
      canProcessVoice: gateStatus.canPassVoice,
      canProcessSystem: true // System always works
    };
  }
}

// Singleton instance
export const orchestrator = new VoiceOrchestrator();

// Export convenience functions
export const routeMessage = (input: MessageInput) => orchestrator.routeMessage(input);
export const handleUserGesture = (type: 'tap' | 'click' | 'keypress') => orchestrator.handleUserGesture(type);
export const getOrchestratorStatus = () => orchestrator.getStatus();