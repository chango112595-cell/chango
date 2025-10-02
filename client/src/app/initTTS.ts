/**
 * TTS Initialization Module
 * Sets up the local-only Text-To-Speech system
 */

import { voiceOrchestrator } from '../voice/tts/orchestrator';
import { LocalNeuralProvider } from '../voice/tts/providers/localNeural';

/**
 * Initialize the TTS system with local provider only
 */
export function initTTS(): void {
  console.log('[InitTTS] Initializing Text-To-Speech system...');
  
  try {
    // Create and register the local neural provider
    const localProvider = new LocalNeuralProvider();
    
    // Check if the provider is available
    if (!localProvider.isAvailable()) {
      console.error('[InitTTS] Web Speech API is not available in this browser');
      console.warn('[InitTTS] TTS functionality will be limited');
      return;
    }
    
    // Register the local provider with the orchestrator
    voiceOrchestrator.registerLocal(localProvider);
    
    // Verify the orchestrator is ready
    if (voiceOrchestrator.isReady()) {
      console.log('[InitTTS] TTS system initialized successfully');
      console.log('[InitTTS] Using profile:', voiceOrchestrator.getProfile().name);
      
      // Log available voices after a brief delay (to allow voices to load)
      setTimeout(async () => {
        try {
          const voices = await voiceOrchestrator.getVoices();
          console.log(`[InitTTS] Available voices: ${voices.length}`);
          if (voices.length > 0) {
            console.log('[InitTTS] Sample voices:', voices.slice(0, 5));
          }
        } catch (error) {
          console.warn('[InitTTS] Could not retrieve voice list:', error);
        }
      }, 1000);
    } else {
      console.error('[InitTTS] TTS orchestrator failed to initialize');
    }
    
  } catch (error) {
    console.error('[InitTTS] Failed to initialize TTS:', error);
  }
}

/**
 * Test the TTS system with a sample message
 * Useful for debugging and verification
 */
export async function testTTS(message?: string): Promise<void> {
  const testMessage = message || "Hello! The Text-To-Speech system is now operational.";
  
  if (!voiceOrchestrator.isReady()) {
    console.error('[TestTTS] TTS system is not ready');
    return;
  }
  
  console.log('[TestTTS] Testing TTS with message:', testMessage);
  
  try {
    await voiceOrchestrator.speak(testMessage);
    console.log('[TestTTS] Test completed successfully');
  } catch (error) {
    console.error('[TestTTS] Test failed:', error);
  }
}

// Export for use in browser console debugging
if (typeof window !== 'undefined') {
  (window as any).testTTS = testTTS;
  (window as any).voiceOrchestrator = voiceOrchestrator;
}