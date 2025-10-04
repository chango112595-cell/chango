/**
 * Expose necessary modules to window for testing
 * This file ensures all required modules are accessible during tests
 */

import { voiceOrchestrator } from '@/voice/tts/orchestrator';
import { GlobalMonitor } from '@/monitor/GlobalMonitor';
import { alwaysListen } from '@/voice/always_listen';
import { voiceBus } from '@/voice/voiceBus';

export function exposeTestModules() {
  if (import.meta.env.DEV) {
    // Expose modules to window
    const testModules = {
      voiceOrchestrator,
      GlobalMonitor,
      alwaysListen,
      voiceBus
    };
    
    // Add to window
    Object.assign(window, testModules);
    
    console.log('[TestModules] Exposed to window:', Object.keys(testModules));
    
    // Log status of each module
    console.log('[TestModules] Module status:', {
      voiceOrchestrator: !!voiceOrchestrator && voiceOrchestrator.isReady(),
      GlobalMonitor: !!GlobalMonitor,
      alwaysListen: !!alwaysListen && alwaysListen.getStatus().isEnabled,
      voiceBus: !!voiceBus
    });
  }
}

// Auto-expose on import
exposeTestModules();