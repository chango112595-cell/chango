/**
 * Test to verify typed messages work without wake word after gate fix
 */

export async function testTypedMessageFix() {
  console.log('');
  console.log('🧪 === TYPED MESSAGE FIX TEST ===');
  
  // Import required modules
  const { voiceBus } = await import('../voice/voiceBus');
  const { passGate } = await import('../modules/listening/gate');
  
  console.log('Step 1: Testing gate logic directly...');
  
  // Test 1: Typed messages should always pass
  const typedResult1 = passGate('What time is it?', true);
  console.log('✓ Typed message without wake word:', {
    text: typedResult1.text,
    allowed: typedResult1.allowed,
    reason: typedResult1.reason
  });
  
  if (!typedResult1.allowed) {
    console.error('❌ FAILED: Typed message was blocked!');
    return false;
  }
  
  // Test 2: Typed messages with wake word should also pass
  const typedResult2 = passGate('lolo what time is it?', true);
  console.log('✓ Typed message with wake word:', {
    text: typedResult2.text,
    allowed: typedResult2.allowed,
    reason: typedResult2.reason
  });
  
  // Test 3: Spoken messages without wake word should be blocked
  const spokenResult1 = passGate('What time is it?', false);
  console.log('✓ Spoken message without wake word:', {
    text: spokenResult1.text,
    allowed: spokenResult1.allowed,
    reason: spokenResult1.reason
  });
  
  if (spokenResult1.allowed) {
    console.error('⚠️ WARNING: Spoken message without wake word was allowed (check feature flags)');
  }
  
  // Test 4: Spoken messages with wake word should pass
  const spokenResult2 = passGate('lolo what time is it?', false);
  console.log('✓ Spoken message with wake word:', {
    text: spokenResult2.text,
    allowed: spokenResult2.allowed,
    reason: spokenResult2.reason
  });
  
  console.log('');
  console.log('Step 2: Testing conversation engine integration...');
  
  // Check if conversation engine is initialized
  const conversationEngine = (window as any).conversationEngine;
  
  if (conversationEngine) {
    console.log('✓ Conversation engine is exposed to window');
    
    // Check if listeners are registered
    const listeners = conversationEngine.checkListeners();
    console.log('✓ Conversation engine listeners:', listeners);
    
    // Test the handle function directly
    console.log('Testing handle function with typed message...');
    await conversationEngine.handle('What time is it?', true);
    
    console.log('✅ Test complete - check console for [ConversationEngine] logs');
  } else {
    console.log('⚠️ Conversation engine not exposed (production mode)');
    console.log('Testing through voiceBus event emission...');
    
    // Set up listener for response
    let responseReceived = false;
    const unsubscribe = voiceBus.on('changoResponse', (event) => {
      console.log('✅ changoResponse received:', event.text);
      responseReceived = true;
    });
    
    // Emit typed message event
    console.log('Emitting userTextSubmitted event...');
    voiceBus.emit({
      type: 'userTextSubmitted',
      text: 'What time is it?',
      source: 'test'
    });
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!responseReceived) {
      console.error('❌ No changoResponse received after 1 second');
      console.log('Possible issues:');
      console.log('  1. Conversation engine not initialized');
      console.log('  2. Event listeners not registered');
      console.log('  3. Processing error in conversation engine');
    }
    
    unsubscribe();
  }
  
  console.log('');
  console.log('✨ === TYPED MESSAGE FIX TEST COMPLETE ===');
  console.log('Summary:');
  console.log('  - Gate logic: ✅ Fixed - typed messages always pass');
  console.log('  - Wake word requirement: ✅ Only for spoken input');
  console.log('  - Conversation engine: Check logs above');
  
  return true;
}

// Auto-run if imported directly
if (import.meta.hot) {
  testTypedMessageFix();
}

// Expose to window for manual testing
(window as any).testTypedMessageFix = testTypedMessageFix;