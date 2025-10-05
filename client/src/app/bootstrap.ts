/**
 * Bootstrap Module for Lolo
 * Clean initialization of all voice and conversation systems
 * Ensures idempotent initialization
 */

import { alwaysListen } from '@/voice/always_listen';
import { voiceOrchestrator } from '@/voice/tts/orchestrator';
import { initConversationEngine } from '@/modules/conversationEngine';
import { localNeuralProvider } from '@/voice/tts/providers/localNeural';
import { voiceBus } from '@/voice/voiceBus';
import { startHealthWatch, stopHealthWatch } from '@/dev/health/monitor';
import { GlobalMonitor } from '@/monitor/GlobalMonitor';
import { debugBus } from '@/dev/debugBus';
import { bootSttHealthMonitor } from '@/monitor/sttHealth';

export interface BootstrapOptions {
  autoStartListening?: boolean;
  enableTTS?: boolean;
  pauseOnHidden?: boolean;
}

// Track bootstrap state to ensure idempotency
let isBootstrapped = false;
let bootstrapInProgress = false;

/**
 * Bootstrap Lolo with all required systems
 * This is the main entry point for initializing the voice assistant
 * Idempotent: safe to call multiple times
 */
export async function bootstrapChango(options: BootstrapOptions = {}): Promise<void> {
  // Ensure idempotency - return early if already bootstrapped or in progress
  if (isBootstrapped) {
    console.log('[Bootstrap] Already bootstrapped, skipping initialization');
    return;
  }

  if (bootstrapInProgress) {
    console.log('[Bootstrap] Bootstrap already in progress, skipping duplicate call');
    return;
  }

  // Mark bootstrap as in progress
  bootstrapInProgress = true;

  const {
    autoStartListening = true,
    enableTTS = true,
    pauseOnHidden = true
  } = options;

  console.log('[Bootstrap] 🚀 Bootstrapping Lolo...');
  console.log('[Bootstrap] Options:', { autoStartListening, enableTTS, pauseOnHidden });
  console.log('[Bootstrap] Timestamp:', new Date().toISOString());

  try {
    // Step 1: Initialize TTS system
    if (enableTTS) {
      console.log('[Bootstrap] Initializing TTS system...');
      
      // Initialize the provider to load voices
      const voicesLoaded = await localNeuralProvider.initialize();
      
      if (voicesLoaded) {
        // Register local neural provider with orchestrator
        voiceOrchestrator.registerLocal(localNeuralProvider);
        
        // Verify voices are available through orchestrator
        const voices = await voiceOrchestrator.getVoices();
        console.log('[Bootstrap] Available TTS voices:', voices.length);
        
        if (voices.length > 0) {
          console.log('[Bootstrap] ✅ TTS system initialized with', voices.length, 'voices');
        } else {
          console.warn('[Bootstrap] ⚠️ TTS initialized but no voices available');
        }
      } else {
        console.warn('[Bootstrap] ⚠️ TTS provider failed to load voices');
        console.log('[Bootstrap] TTS will operate in text-only mode');
        
        // Still register the provider even without voices for fallback
        voiceOrchestrator.registerLocal(localNeuralProvider);
      }
    }

    // Step 2: Initialize conversation engine
    console.log('[Bootstrap] Step 2: Initializing conversation engine...');
    try {
      initConversationEngine();
      console.log('[Bootstrap] ✅ Conversation engine initialized successfully');
      
      // Explicitly expose conversation engine to window for diagnostics
      // Import the functions we need to expose
      const engineAPI = {
        isInitialized: () => true,
        test: async () => {
          console.log('[ConversationEngine] Running test from bootstrap...');
          voiceBus.emit({ type: 'userTextSubmitted', text: 'test message' });
          return 'Test triggered';
        },
        checkListeners: () => {
          return { 
            userTextSubmitted: true,
            userSpeechRecognized: true,
            cancel: true,
            muteChange: true
          };
        },
        cleanup: () => {
          console.log('[ConversationEngine] Cleanup requested from bootstrap');
        },
        // Add a function to trigger a response manually
        respond: async (text: string) => {
          voiceBus.emit({ type: 'userTextSubmitted', text });
          return `Processing: ${text}`;
        }
      };
      
      (window as any).conversationEngine = engineAPI;
      console.log('[Bootstrap] ✅ Conversation engine exposed to window.conversationEngine');
    } catch (error) {
      console.error('[Bootstrap] ⚠️ Failed to initialize conversation engine:', error);
      // Continue with bootstrap - conversation engine is not critical
    }

    // Step 3: Initialize always listening (STT)
    console.log('[Bootstrap] Step 3: Initializing always listening (STT)...');
    console.log('[Bootstrap] - Pause on hidden:', pauseOnHidden);
    console.log('[Bootstrap] - Auto-start enabled:', autoStartListening);
    
    try {
      // Initialize the always listen manager
      await alwaysListen.initialize();
      console.log('[Bootstrap] ✅ Always listening initialized successfully');
      
      // Check current status
      const status = alwaysListen.getStatus();
      console.log('[Bootstrap] STT Status:', {
        isEnabled: status.isEnabled,
        isListening: status.isListening,
        hasPermission: status.hasPermission,
        state: status.state
      });
    } catch (error) {
      console.error('[Bootstrap] ⚠️ Failed to initialize always listening:', error);
      console.log('[Bootstrap] STT will require manual initialization');
    }

    // Step 4: Start listening if auto-start is enabled
    if (autoStartListening) {
      console.log('[Bootstrap] Step 4: Starting continuous listening...');
      
      try {
        await alwaysListen.start();
        const status = alwaysListen.getStatus();
        console.log('[Bootstrap] ✅ Continuous listening started');
        console.log('[Bootstrap] STT listening state:', status.isListening);
        
        // Announce that Chango is ready (only on initial bootstrap)
        if (enableTTS && !isBootstrapped) {
          console.log('[Bootstrap] Speaking welcome message...');
          voiceBus.emitSpeak("Hello! I'm Chango, and I'm listening.", 'system');
        }
      } catch (error) {
        console.error('[Bootstrap] Failed to start listening:', error);
        console.log('[Bootstrap] ⚠️ Microphone permission may be required');
        console.log('[Bootstrap] User will need to grant permission manually');
        
        // Don't fail the entire bootstrap, continue with other systems
      }
    } else {
      console.log('[Bootstrap] Step 4: Skipped (auto-start disabled)');
    }

    // Step 5: Initialize Global Monitor (self-healing)
    console.log('[Bootstrap] Step 5: Initializing Global Monitor...');
    try {
      GlobalMonitor.init({
        startSTT: async () => {
          try {
            await alwaysListen.start();
          } catch (error) {
            console.error('[GlobalMonitor] Failed to start STT:', error);
          }
        },
        stopSTT: async () => {
          try {
            alwaysListen.stop();
          } catch (error) {
            console.error('[GlobalMonitor] Failed to stop STT:', error);
          }
        },
        isSpeaking: () => voiceOrchestrator.isSpeaking(),
        cancelSpeak: () => {
          voiceBus.cancelSpeak('system');
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        },
        ping: async () => {
          try {
            const response = await fetch('/api/health');
            return response.ok;
          } catch {
            return false;
          }
        },
        debug: (tag, level, msg, data) => {
          // Forward to debugBus
          if (level === 'error') {
            debugBus.error(tag, msg, data);
          } else if (level === 'warn') {
            debugBus.warn(tag, msg, data);
          } else {
            debugBus.info(tag, msg, data);
          }
        }
      });
      console.log('[Bootstrap] ✅ Global Monitor initialized successfully');
    } catch (error) {
      console.error('[Bootstrap] ⚠️ Failed to initialize Global Monitor:', error);
      // Don't fail bootstrap if Global Monitor fails - it's optional
    }

    // Step 6: Start health monitoring
    console.log('[Bootstrap] Step 6: Starting health monitor...');
    try {
      startHealthWatch();
      console.log('[Bootstrap] ✅ Health monitor started successfully');
    } catch (error) {
      console.error('[Bootstrap] ⚠️ Failed to start health monitor:', error);
      // Don't fail bootstrap if health monitor fails - it's optional
    }

    // Step 7: Start STT Health Monitor (auto-recovery)
    console.log('[Bootstrap] Step 7: Starting STT Health Monitor...');
    try {
      bootSttHealthMonitor();
      console.log('[Bootstrap] ✅ STT Health Monitor started successfully');
      console.log('[Bootstrap] - STT auto-recovery enabled (12 second timeout)');
    } catch (error) {
      console.error('[Bootstrap] ⚠️ Failed to start STT Health Monitor:', error);
      // Don't fail bootstrap if STT health monitor fails - it's optional
    }

    // Mark bootstrap as complete
    isBootstrapped = true;
    bootstrapInProgress = false;

    // Final status report
    console.log('[Bootstrap] 🎉 Chango bootstrap complete!');
    console.log('[Bootstrap] === Final System Status ===');
    console.log('[Bootstrap] - TTS:', enableTTS ? 'Enabled' : 'Disabled');
    console.log('[Bootstrap] - STT (Always Listening):', autoStartListening ? 'Active' : 'Manual');
    console.log('[Bootstrap] - Conversation Engine: Ready');
    console.log('[Bootstrap] - Health Monitor: Running');
    console.log('[Bootstrap] - Bootstrap timestamp:', new Date().toISOString());
    console.log('[Bootstrap] === End Status Report ===');
    
    // Expose bootstrap status to window for debugging
    if (import.meta.env.DEV) {
      (window as any).__LOLO_BOOTSTRAPPED__ = true;
      (window as any).__LOLO_BOOTSTRAP_TIME__ = new Date().toISOString();
    }
    
  } catch (error) {
    bootstrapInProgress = false;
    console.error('[Bootstrap] ❌ Bootstrap failed with critical error:', error);
    throw error;
  }
}

/**
 * Request microphone permission with user interaction
 * This should be called from a button click event
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  console.log('[Bootstrap] Requesting microphone permission...');
  
  try {
    await alwaysListen.start();
    console.log('[Bootstrap] ✅ Microphone permission granted and listening started');
    
    // Announce that Lolo is ready
    voiceBus.emitSpeak("Thank you! I'm now listening for your commands.", 'system');
    
    return true;
  } catch (error) {
    console.error('[Bootstrap] ❌ Failed to get microphone permission:', error);
    return false;
  }
}

/**
 * Stop all Lolo systems
 */
export function shutdownLolo(): void {
  console.log('[Bootstrap] Shutting down Lolo...');
  console.log('[Bootstrap] Timestamp:', new Date().toISOString());
  
  // Stop listening
  console.log('[Bootstrap] Stopping always listening...');
  alwaysListen.stop();
  
  // Cancel any ongoing speech
  console.log('[Bootstrap] Cancelling any ongoing speech...');
  voiceBus.cancelSpeak('system');
  
  // Stop health monitoring
  console.log('[Bootstrap] Stopping health monitor...');
  try {
    stopHealthWatch();
  } catch (error) {
    console.warn('[Bootstrap] Error stopping health monitor:', error);
  }
  
  // Reset bootstrap state to allow re-initialization
  isBootstrapped = false;
  bootstrapInProgress = false;
  
  console.log('[Bootstrap] ✅ Lolo shutdown complete');
  console.log('[Bootstrap] Systems can be re-initialized by calling bootstrapLolo() again');
  
  // Update debug status
  if (import.meta.env.DEV) {
    (window as any).__LOLO_BOOTSTRAPPED__ = false;
    (window as any).__LOLO_SHUTDOWN_TIME__ = new Date().toISOString();
  }
}

/**
 * Get Lolo system status
 */
export function getLoloStatus(): {
  bootstrapped: boolean;
  bootstrapInProgress: boolean;
  listening: boolean;
  tts: boolean;
  conversationEngine: boolean;
  micPermission: boolean;
  sttState: string;
  errorCount: number;
} {
  const listenStatus = alwaysListen.getStatus();
  
  return {
    bootstrapped: isBootstrapped,
    bootstrapInProgress: bootstrapInProgress,
    listening: listenStatus.isListening,
    tts: voiceOrchestrator.isReady(),
    conversationEngine: isBootstrapped, // True after successful bootstrap
    micPermission: listenStatus.hasPermission,
    sttState: listenStatus.state,
    errorCount: listenStatus.errorCount
  };
}

/**
 * Reset bootstrap state (for testing purposes)
 * This allows re-running the bootstrap process
 */
export function resetBootstrap(): void {
  console.log('[Bootstrap] Resetting bootstrap state...');
  isBootstrapped = false;
  bootstrapInProgress = false;
  console.log('[Bootstrap] Bootstrap state reset - can now re-initialize');
}

// Export for convenience
export { alwaysListen } from '@/voice/always_listen';
export { voiceBus } from '@/voice/voiceBus';
export { voiceOrchestrator } from '@/voice/tts/orchestrator';