/**
 * Test file for verifying TTS functionality
 */

import { localNeuralProvider } from './voice/tts/providers/localNeural';
import { voiceOrchestrator } from './voice/tts/orchestrator';

export async function testTTS() {
  console.log('=== TTS Test Starting ===');
  
  // Test 1: Check if provider is available
  console.log('Test 1: Provider availability');
  console.log('LocalNeuralProvider available:', localNeuralProvider.isAvailable());
  
  // Test 2: Get voices
  console.log('\nTest 2: Getting voices...');
  try {
    const voices = await localNeuralProvider.getVoices();
    console.log('Available voices count:', voices.length);
    if (voices.length > 0) {
      console.log('First 5 voices:', voices.slice(0, 5));
    }
  } catch (error) {
    console.error('Failed to get voices:', error);
  }
  
  // Test 3: Test voiceOrchestrator
  console.log('\nTest 3: VoiceOrchestrator status');
  console.log('VoiceOrchestrator ready:', voiceOrchestrator.isReady());
  
  // Test 4: Try to speak
  console.log('\nTest 4: Testing speech...');
  try {
    await voiceOrchestrator.speak('Hello! This is a test of the text to speech system. Can you hear me?', {
      interrupt: true
    });
    console.log('✅ Speech test completed successfully');
  } catch (error) {
    console.error('❌ Speech test failed:', error);
  }
  
  console.log('\n=== TTS Test Complete ===');
}

// Expose to window for easy testing
if (typeof window !== 'undefined') {
  (window as any).testTTS = testTTS;
  console.log('TTS test function loaded. Run testTTS() in console to test.');
}