/**
 * Health Check for Conversation Engine
 * Monitors conversation engine initialization and response processing
 */

import { registerHealthCheck } from '../healthRegistry';
import { debugBus } from '../../dev/debugBus';
import { voiceBus } from '../../voice/voiceBus';

// Track conversation engine state
let lastConversationActivity = Date.now();
let lastUserInput = 0;
let lastBotResponse = 0;
let isInitialized = false;
let hasEventListeners = false;
let consecutiveFailures = 0;
let lastResponseTime = 0;
let pendingRequest = false;
let requestStartTime = 0;

// Track initialization state
debugBus.subscribe((event) => {
  // Monitor conversation engine events
  if (event.module === 'ConversationEngine') {
    if (event.message.includes('Initializing') || 
        event.message.includes('Initialization complete')) {
      isInitialized = true;
      lastConversationActivity = Date.now();
    }
    
    if (event.message.includes('RECEIVED userTextSubmitted') || 
        event.message.includes('RECEIVED userSpeechRecognized')) {
      lastUserInput = Date.now();
      pendingRequest = true;
      requestStartTime = Date.now();
    }
    
    if (event.message.includes('changoResponse event emitted') ||
        event.message.includes('respond() function completed')) {
      lastBotResponse = Date.now();
      lastResponseTime = Date.now() - requestStartTime;
      pendingRequest = false;
      consecutiveFailures = 0;
    }
    
    if (event.message.includes('Event listeners registered')) {
      hasEventListeners = true;
    }
    
    if (event.type === 'error') {
      consecutiveFailures++;
    }
  }
  
  // Monitor changoResponse events
  if (event.module === 'Chat' && event.message.includes('Received Chango response')) {
    lastBotResponse = Date.now();
    lastResponseTime = Date.now() - requestStartTime;
    pendingRequest = false;
  }
});

// Also monitor voice bus events directly
let voiceBusSubscribed = false;
if (!voiceBusSubscribed) {
  voiceBus.on('changoResponse', () => {
    lastBotResponse = Date.now();
    if (pendingRequest) {
      lastResponseTime = Date.now() - requestStartTime;
      pendingRequest = false;
    }
  });
  
  voiceBus.on('userTextSubmitted', () => {
    lastUserInput = Date.now();
    pendingRequest = true;
    requestStartTime = Date.now();
  });
  
  voiceBusSubscribed = true;
}

registerHealthCheck({
  name: 'conversation.engine',
  cadenceMs: 2000, // Check every 2 seconds
  run: async () => {
    const now = Date.now();
    
    // Check if conversation engine is initialized
    if (!isInitialized && typeof window !== 'undefined') {
      // Check if it's exposed to window
      const isExposed = !!(window as any).conversationEngine;
      if (!isExposed) {
        return {
          ok: false,
          event: { 
            id: 'conversation.engine.not.initialized',
            domain: 'core',
            severity: 'critical',
            msg: 'Conversation Engine is NOT exposed to window',
            fixable: true
          },
          fix: async () => {
            try {
              // Try to re-initialize
              const initFunc = (window as any).__initConversationEngine;
              if (initFunc) {
                await initFunc();
                return true;
              }
              return false;
            } catch { return false; }
          }
        };
      } else {
        // Engine is exposed, mark as initialized
        isInitialized = true;
      }
    }
    
    // Check for pending request timeout (no response after 10 seconds)
    if (pendingRequest && (now - requestStartTime) > 10000) {
      return {
        ok: false,
        event: { 
          id: 'conversation.response.timeout',
          domain: 'core',
          severity: 'error',
          msg: `No response received for ${Math.round((now - requestStartTime) / 1000)}s`,
          fixable: false
        }
      };
    }
    
    // Check if we haven't received responses to recent inputs
    const timeSinceInput = now - lastUserInput;
    const timeSinceResponse = now - lastBotResponse;
    
    if (lastUserInput > 0 && timeSinceInput < 5000 && timeSinceResponse > 5000) {
      // User input within last 5s but no response in last 5s
      return {
        ok: false,
        event: { 
          id: 'conversation.not.responding',
          domain: 'core',
          severity: 'error',
          msg: 'changoResponse was NOT received',
          fixable: true
        },
        fix: async () => {
          try {
            // Try to reinitialize conversation engine
            const engine = (window as any).conversationEngine;
            if (engine && engine.cleanup && engine.test) {
              engine.cleanup();
              await new Promise(resolve => setTimeout(resolve, 100));
              // Re-initialize through bootstrap
              const bootstrap = (window as any).bootstrapChango;
              if (bootstrap) {
                await bootstrap({ autoStartListening: false });
              }
              return true;
            }
            return false;
          } catch { return false; }
        }
      };
    }
    
    // Check for high failure rate
    if (consecutiveFailures > 3) {
      return {
        ok: false,
        event: { 
          id: 'conversation.high.failure.rate',
          domain: 'core',
          severity: 'error',
          msg: `Message processing failed ${consecutiveFailures} times in a row`,
          fixable: false
        }
      };
    }
    
    // Check response time
    if (lastResponseTime > 5000) {
      return {
        ok: false,
        event: { 
          id: 'conversation.slow.response',
          domain: 'core',
          severity: 'warn',
          msg: `Slow response time: ${Math.round(lastResponseTime / 1000)}s`,
          fixable: false
        }
      };
    }
    
    // Everything looks good
    return { ok: true };
  }
});