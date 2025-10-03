/**
 * Test file to verify the voice system is working
 * This can be run from the browser console
 */

import { voiceOrchestrator } from './voice/tts/orchestrator';
import { voiceBus } from './voice/voiceBus';

export async function testVoiceSystem() {
  console.log('[Test] Starting voice system test...');
  
  // Test 1: Check if orchestrator is ready
  if (!voiceOrchestrator.isReady()) {
    console.error('[Test] Voice orchestrator is not ready!');
    return;
  }
  console.log('[Test] ✓ Voice orchestrator is ready');
  
  // Test 2: Test direct speech through orchestrator
  console.log('[Test] Testing direct speech...');
  await voiceOrchestrator.speak('Hello! This is a test of the local neural text-to-speech system.');
  
  // Test 3: Test conversation engine integration
  console.log('[Test] Testing conversation engine integration...');
  voiceBus.emitUserText('What time is it?');
  
  // Wait a bit for the response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Test another conversation
  voiceBus.emitUserText('Who are you?');
  
  console.log('[Test] Voice system test complete!');
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testVoiceSystem = testVoiceSystem;
}