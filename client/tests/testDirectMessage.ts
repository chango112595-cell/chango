/**
 * Direct test for message flow debugging
 */

import { voiceBus } from './voice/voiceBus';

export function testDirectMessage() {
  console.log('===== DIRECT MESSAGE TEST START =====');
  
  // Step 1: Set up a listener to catch userTextSubmitted events
  const unsubscribe = voiceBus.on('userTextSubmitted', (event) => {
    console.log('✅ userTextSubmitted event caught:', event);
  });
  
  // Step 2: Set up a listener to catch loloResponse events
  const unsubscribe2 = voiceBus.on('loloResponse', (event) => {
    console.log('✅ loloResponse event caught:', event);
  });
  
  // Step 3: Send a test message
  const testMessage = "What time is it?";
  console.log('📤 Sending test message:', testMessage);
  
  // Emit the message
  voiceBus.emitUserText(testMessage);
  
  // Clean up after 2 seconds
  setTimeout(() => {
    unsubscribe();
    unsubscribe2();
    console.log('===== DIRECT MESSAGE TEST END =====');
    console.log('Check above for events - if you see userTextSubmitted but no loloResponse, the conversation engine is not processing the message.');
  }, 2000);
}

// Manual test function that simulates the exact flow from Chat component
export function simulateChatMessage() {
  console.log('===== SIMULATING CHAT MESSAGE =====');
  
  const message = "What is today?";
  console.log('[Chat] 📤 SENDING MESSAGE - START');
  console.log('[Chat] Message text:', message);
  console.log('[Chat] 🚀 About to emit userTextSubmitted event');
  console.log('[Chat] voiceBus available?', !!voiceBus);
  console.log('[Chat] voiceBus.emitUserText available?', !!voiceBus.emitUserText);
  
  // Emit the message through voiceBus to be processed by the conversation engine
  voiceBus.emitUserText(message);
  
  console.log('[Chat] 📤 SENDING MESSAGE - COMPLETE');
}

// Expose to window for testing
if (import.meta.env.DEV) {
  (window as any).testDirectMessage = testDirectMessage;
  (window as any).simulateChatMessage = simulateChatMessage;
  console.log('[Test] Direct message test loaded - run testDirectMessage() or simulateChatMessage()');
}