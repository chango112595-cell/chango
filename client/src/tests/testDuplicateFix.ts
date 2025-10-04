/**
 * Test for duplicate message bug fix
 * This test runs directly in the browser console
 */

export async function testDuplicateFix() {
  console.log('');
  console.log('🔧 ==================================================');
  console.log('🔧 DUPLICATE MESSAGE BUG FIX TEST');
  console.log('🔧 ==================================================');
  
  // Track responses
  const responses: { text: string; timestamp: number }[] = [];
  
  // Wait for system initialization
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Set up listener
  const voiceBus = (window as any).voiceBus;
  if (!voiceBus) {
    console.error('❌ VoiceBus not available');
    return;
  }
  
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    responses.push({
      text: event.text,
      timestamp: Date.now()
    });
    console.log(`📥 Response #${responses.length}: ${event.text}`);
  });
  
  // Test 1: Single message
  console.log('\n📝 TEST 1: Single message "lolo what time is it"');
  responses.length = 0;
  
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo what time is it',
    source: 'user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (responses.length === 1) {
    console.log('✅ TEST 1 PASSED: Only 1 response received');
  } else {
    console.error(`❌ TEST 1 FAILED: ${responses.length} responses received (expected 1)`);
    console.log('Responses:', responses);
  }
  
  // Test 2: Another single message
  console.log('\n📝 TEST 2: Single message "lolo hello"');
  responses.length = 0;
  
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo hello',
    source: 'user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (responses.length === 1) {
    console.log('✅ TEST 2 PASSED: Only 1 response received');
  } else {
    console.error(`❌ TEST 2 FAILED: ${responses.length} responses received (expected 1)`);
    console.log('Responses:', responses);
  }
  
  // Cleanup
  unsubscribe();
  
  console.log('\n🔧 ==================================================');
  console.log('🔧 TEST COMPLETE');
  
  // Check if conversation engine was initialized properly
  const conversationEngine = (window as any).conversationEngine;
  if (conversationEngine) {
    console.log('✅ ConversationEngine initialized:', conversationEngine.isInitialized());
    const listeners = conversationEngine.checkListeners();
    console.log('✅ Event listeners:', listeners);
  }
  
  console.log('🔧 ==================================================');
  
  return responses.length === 1;
}

// Auto-expose to window
if (import.meta.env.DEV) {
  (window as any).testDuplicateFix = testDuplicateFix;
  console.log('✅ Duplicate fix test ready. Run: window.testDuplicateFix()');
  
  // Auto-run disabled to prevent message accumulation
  // setTimeout(() => {
  //   console.log('🚀 Auto-running duplicate fix test...');
  //   testDuplicateFix();
  // }, 5000);
}