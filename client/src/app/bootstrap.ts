/**
 * Bootstrap Module for Lolo
 * Clean initialization of all voice and conversation systems
 */

import { alwaysListen } from '@/voice/always_listen';
import { voiceOrchestrator } from '@/voice/tts/orchestrator';
import { initConversationEngine } from '@/modules/conversationEngine';
import { localNeuralProvider } from '@/voice/tts/providers/localNeural';
import { voiceBus } from '@/voice/voiceBus';
import { startHealthWatch } from '@/dev/health/monitor';

export interface BootstrapOptions {
  autoStartListening?: boolean;
  enableTTS?: boolean;
  pauseOnHidden?: boolean;
}

/**
 * Bootstrap Lolo with all required systems
 * This is the main entry point for initializing the voice assistant
 */
export async function bootstrapLolo(options: BootstrapOptions = {}): Promise<void> {
  const {
    autoStartListening = true,
    enableTTS = true,
    pauseOnHidden = true
  } = options;

  console.log('[Bootstrap] 🚀 Bootstrapping Lolo...');
  console.log('[Bootstrap] Options:', { autoStartListening, enableTTS, pauseOnHidden });

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
    console.log('[Bootstrap] Initializing conversation engine...');
    initConversationEngine();
    console.log('[Bootstrap] ✅ Conversation engine initialized');

    // Step 3: Configure always listening
    console.log('[Bootstrap] Configuring always listening...');
    alwaysListen.configure({
      autoRestart: true,
      pauseOnHidden: pauseOnHidden,
      silenceTimeout: 2000
    });

    // Step 4: Initialize always listening
    await alwaysListen.initialize();
    console.log('[Bootstrap] ✅ Always listening initialized');

    // Step 5: Start listening if auto-start is enabled
    if (autoStartListening) {
      console.log('[Bootstrap] Starting continuous listening...');
      
      try {
        await alwaysListen.start();
        console.log('[Bootstrap] ✅ Continuous listening started');
        
        // Announce that Lolo is ready (only on initial startup, not on STT restarts)
        if (enableTTS && !(window as any).__lolo_welcome_spoken__) {
          (window as any).__lolo_welcome_spoken__ = true;
          voiceBus.emitSpeak("Hello! I'm Lolo, and I'm listening.", 'system');
        }
      } catch (error) {
        console.error('[Bootstrap] Failed to start listening:', error);
        console.log('[Bootstrap] ⚠️ Microphone permission may be required');
        
        // Will need user interaction to grant permission
        return;
      }
    }

    // Step 4: Start health monitoring
    console.log('[Bootstrap] Starting health monitor...');
    try {
      startHealthWatch();
      console.log('[Bootstrap] ✅ Health monitor started');
    } catch (error) {
      console.error('[Bootstrap] ⚠️ Failed to start health monitor:', error);
      // Don't fail bootstrap if health monitor fails
    }

    console.log('[Bootstrap] 🎉 Lolo bootstrap complete!');
    console.log('[Bootstrap] System status:');
    console.log('[Bootstrap] - TTS:', enableTTS ? 'Enabled' : 'Disabled');
    console.log('[Bootstrap] - Always Listening:', autoStartListening ? 'Active' : 'Manual');
    console.log('[Bootstrap] - Conversation Engine: Ready');
    
  } catch (error) {
    console.error('[Bootstrap] ❌ Bootstrap failed:', error);
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
  
  // Stop listening
  alwaysListen.stop();
  
  // Cancel any ongoing speech
  voiceBus.cancelSpeak('system');
  
  console.log('[Bootstrap] ✅ Lolo shutdown complete');
}

/**
 * Get Lolo system status
 */
export function getLoloStatus(): {
  listening: boolean;
  tts: boolean;
  conversationEngine: boolean;
  micPermission: boolean;
} {
  const listenStatus = alwaysListen.getStatus();
  
  return {
    listening: listenStatus.isListening,
    tts: voiceOrchestrator.isReady(),
    conversationEngine: true, // Always true after init
    micPermission: listenStatus.hasPermission
  };
}

// Export for convenience
export { alwaysListen } from '@/voice/always_listen';
export { voiceBus } from '@/voice/voiceBus';
export { voiceOrchestrator } from '@/voice/tts/orchestrator';