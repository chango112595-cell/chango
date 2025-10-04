/**
 * Test utility for debugging chat flow
 */

import { voiceBus } from './voice/voiceBus';

export function testChatFlow() {
  console.log('===== CHAT FLOW TEST START =====');
  
  // Test 1: Check voiceBus is available
  console.log('Test 1: voiceBus available?', !!voiceBus);
  console.log('Test 1: voiceBus.emitUserText available?', !!voiceBus.emitUserText);
  
  // Test 2: Check listeners
  const listeners = (voiceBus as any).listeners;
  console.log('Test 2: Total event types registered:', listeners?.size || 0);
  
  if (listeners) {
    listeners.forEach((value: any, key: any) => {
      console.log(`  - Event "${key}" has ${value.size} listener(s)`);
    });
  }
  
  // Test 3: Send a test message
  const testMessage = "What time is it?";
  console.log('Test 3: Sending test message:', testMessage);
  
  // Add a temporary listener to confirm the event is emitted
  const unsubscribe = voiceBus.on('userTextSubmitted', (event) => {
    console.log('Test 3: userTextSubmitted event received in test listener!', event);
  });
  
  // Emit the message
  voiceBus.emitUserText(testMessage);
  
  // Clean up
  setTimeout(() => {
    unsubscribe();
    console.log('===== CHAT FLOW TEST END =====');
  }, 1000);
}

// Expose to window for testing
if (import.meta.env.DEV) {
  (window as any).testChatFlow = testChatFlow;
  console.log('[Test] Chat flow test loaded - run testChatFlow() to debug');
}