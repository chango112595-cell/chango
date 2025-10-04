/**
 * Initialize Health Monitor
 * Auto-starts the health monitor and provides test utilities
 */

import { startHealthWatch, beat } from '../dev/health/monitor';
import { debugBus } from '../dev/debugBus';
import { FEATURES } from '../config/featureFlags';

export function initHealthMonitor() {
  // Only initialize if debug features are enabled
  if (!FEATURES.DEBUG_BUS || !FEATURES.AUTO_HEAL) {
    console.log('[InitHealthMonitor] Health monitoring disabled (check AUTO_HEAL and DEBUG_BUS flags)');
    return;
  }
  
  console.log('[InitHealthMonitor] Initializing health monitor system...');
  
  // The health monitor auto-starts in the module now, but let's ensure it's running
  try {
    // Send initial heartbeats to establish baseline
    beat('stt', { initialized: true });
    beat('gate', { initialized: true });
    beat('tts', { initialized: true });
    
    console.log('[InitHealthMonitor] Initial heartbeats sent');
    
    // Simulate some activity after 2 seconds
    setTimeout(() => {
      console.log('[InitHealthMonitor] Simulating activity...');
      
      // Simulate STT activity
      debugBus.info('STT', 'transcript', { text: 'Test message from init' });
      beat('stt', { transcript: 'Test message' });
      
      // Simulate Gate activity
      debugBus.info('Gate', 'pass', { text: 'Test input', reason: 'test' });
      beat('gate', { passed: true, text: 'Test input' });
      
      // Simulate TTS activity
      debugBus.info('TTS', 'speak', { text: 'Test speech' });
      beat('tts', { speaking: true, text: 'Test speech' });
      
      // Stop TTS after 1 second
      setTimeout(() => {
        debugBus.info('TTS', 'end', { text: 'Test speech' });
        beat('tts', { speaking: false });
        console.log('[InitHealthMonitor] Activity simulation complete');
      }, 1000);
    }, 2000);
    
    // Log health state periodically
    setInterval(() => {
      const state = (window as any).__CH_HEALTH__?.getState();
      if (state && state.isMonitoring) {
        const now = Date.now();
        console.log('[InitHealthMonitor] Health Check:', {
          monitoring: state.isMonitoring,
          sttAge: Math.round((now - state.lastSttHeartbeat) / 1000) + 's ago',
          gateAge: Math.round((now - state.lastGateHeartbeat) / 1000) + 's ago',
          ttsAge: Math.round((now - state.lastTtsHeartbeat) / 1000) + 's ago',
          ttsSpeaking: state.isTtsSpeaking
        });
      }
    }, 10000); // Log every 10 seconds
    
  } catch (error) {
    console.error('[InitHealthMonitor] Error during initialization:', error);
  }
  
  console.log('[InitHealthMonitor] Health monitor system initialized');
}

// Auto-initialize in development mode
if (import.meta.env.DEV) {
  // Wait for everything to be ready
  setTimeout(() => {
    initHealthMonitor();
  }, 1000);
}