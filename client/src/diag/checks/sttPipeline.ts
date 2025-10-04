import { registerHealthCheck } from '../healthRegistry';
import { debugBus } from '../../dev/debugBus';

let lastSttActivity = Date.now();
let lastSttError = 0;
let sttState = 'unknown';
let hasPermission = true;
let consecutiveErrors = 0;

// Track STT activity and state from debug bus
debugBus.subscribe((event) => {
  // Track any STT activity
  if (event.module === 'STT' || event.module === 'AlwaysListen') {
    if (event.message.includes('transcript') || 
        event.message === 'Recognition started' ||
        event.message === 'Speech detected') {
      lastSttActivity = Date.now();
      sttState = 'active';
      consecutiveErrors = 0; // Reset error count on success
    }
    
    // Track errors
    if (event.type === 'error') {
      lastSttError = Date.now();
      consecutiveErrors++;
      
      // Check for permission issues
      if (event.message.includes('not-allowed') || 
          event.message.includes('Permission denied')) {
        hasPermission = false;
      }
    }
  }
  
  // Track health heartbeats
  if (event.module === 'Health' && event.message === 'stt_heartbeat') {
    if (event.data?.state) {
      sttState = event.data.state;
      if (event.data.state === 'listening' || event.data.state === 'starting') {
        lastSttActivity = Date.now();
      }
    }
    if (event.data?.hasPermission !== undefined) {
      hasPermission = event.data.hasPermission;
    }
  }
});

registerHealthCheck({
  name: 'stt.pipeline',
  cadenceMs: 5000, // Check less frequently
  run: () => {
    // Don't check if page is hidden or no permission
    if (!hasPermission || document.hidden) {
      return { ok: true }; // Not a real issue
    }
    
    // Only consider it idle if it's been >30s without any activity
    // AND there was a recent error
    const timeSinceActivity = Date.now() - lastSttActivity;
    const timeSinceError = Date.now() - lastSttError;
    const isIdle = timeSinceActivity > 30000 && timeSinceError < 5000;
    
    if(!isIdle) return { ok: true };
    
    return {
      ok: false,
      event: { 
        id:'stt.pipeline.idle', 
        domain:'stt', 
        severity:'warn', 
        msg:`STT idle for ${Math.round(timeSinceActivity/1000)}s after error`, 
        fixable:true 
      },
      fix: async () => {
        try{
          // Only try to restart if we have permission
          if (hasPermission && !document.hidden) {
            await (window as any).__chango?.stt?.restart?.();
            return true;
          }
          return false;
        }catch{ return false; }
      }
    };
  }
});