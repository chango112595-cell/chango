/**
 * INLINE FIX FOR CONVERSATION ENGINE
 * Copy and paste this entire script into browser console to fix the issue
 */

// This script can be run directly in browser console
(async function() {
  console.log('\n🔧 === INLINE CONVERSATION ENGINE FIX ===\n');
  
  // Step 1: Check current state
  console.log('📋 CURRENT STATE:');
  console.log('  window.voiceBus:', !!window.voiceBus ? '✅ Available' : '❌ Missing');
  console.log('  window.conversationEngine:', !!window.conversationEngine ? '✅ Available' : '❌ Missing');
  console.log('  window.listeningGate:', !!window.listeningGate ? '✅ Available' : '❌ Missing');
  
  if (!window.conversationEngine) {
    console.log('\n🚨 CRITICAL: Conversation engine not found!');
    console.log('⚠️  The conversation engine module needs to be manually initialized.');
    console.log('⚠️  This indicates the bootstrap process didn\'t complete properly.');
    
    // Try to get modules from the window if they exist
    if (!window.__CONVERSATION_ENGINE_MODULE__) {
      console.error('❌ Cannot fix: Conversation engine module not available');
      console.log('   The module needs to be imported and initialized from the app');
      return;
    }
    
    // Initialize the conversation engine
    console.log('\n🔧 Attempting manual initialization...');
    window.__CONVERSATION_ENGINE_MODULE__.initConversationEngine();
    
    // Check again
    if (window.conversationEngine) {
      console.log('✅ Conversation engine initialized successfully!');
    } else {
      console.error('❌ Failed to initialize conversation engine');
      return;
    }
  }
  
  // Step 2: Test event flow
  console.log('\n📧 TESTING EVENT FLOW:');
  
  if (!window.voiceBus) {
    console.error('❌ Cannot test: voiceBus not available');
    return;
  }
  
  // Set up test
  let testPassed = false;
  const testPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!testPassed) {
        console.error('❌ TEST FAILED: No changoResponse received after 3 seconds');
        console.log('\n🔍 DEBUGGING INFO:');
        console.log('  1. Check if conversation engine listeners are registered');
        if (window.conversationEngine && window.conversationEngine.checkListeners) {
          const listeners = window.conversationEngine.checkListeners();
          console.log('  Listeners:', listeners);
        }
        console.log('  2. Check browser console for [ConversationEngine] logs');
        console.log('  3. Check if gate is blocking messages (needs "lolo" prefix)');
      }
      resolve(testPassed);
    }, 3000);
    
    const unsubscribe = window.voiceBus.on('changoResponse', (event) => {
      testPassed = true;
      clearTimeout(timeout);
      console.log('✅ TEST PASSED: changoResponse received!');
      console.log('   Response:', event.text);
      unsubscribe();
      resolve(true);
    });
    
    // Emit test event
    console.log('  Emitting: "lolo what time is it"...');
    window.voiceBus.emit({
      type: 'userTextSubmitted',
      text: 'lolo what time is it',
      source: 'user'
    });
  });
  
  const result = await testPromise;
  
  // Step 3: Summary
  console.log('\n📊 === FIX SUMMARY ===');
  
  if (result) {
    console.log('✅ SYSTEM WORKING PROPERLY!');
    console.log('  - Conversation engine is initialized');
    console.log('  - Event listeners are working');
    console.log('  - Gate filtering with "lolo" prefix is working');
    console.log('  - Response generation is working');
    console.log('\nYou can now:');
    console.log('  - Use voice commands starting with "lolo"');
    console.log('  - Type messages starting with "lolo" in the chat');
    console.log('  - Run testConversationFlow() for full test suite');
  } else {
    console.error('❌ SYSTEM NEEDS ATTENTION');
    console.log('\nTroubleshooting steps:');
    console.log('  1. Refresh the page');
    console.log('  2. Check for errors in console');
    console.log('  3. Verify the conversation engine module is loaded');
    console.log('  4. Check that bootstrap is being called');
  }
  
  // Export test function for repeated testing
  window.testConversationEngine = async () => {
    console.log('\n🧪 Quick test...');
    
    return new Promise((resolve) => {
      let received = false;
      const timeout = setTimeout(() => {
        if (!received) {
          console.log('❌ No response');
        }
        resolve(received);
      }, 2000);
      
      const unsub = window.voiceBus.on('changoResponse', (e) => {
        received = true;
        clearTimeout(timeout);
        console.log('✅ Response:', e.text);
        unsub();
        resolve(true);
      });
      
      window.voiceBus.emit({
        type: 'userTextSubmitted',
        text: 'lolo what time is it',
        source: 'user'
      });
    });
  };
  
  console.log('\n💡 TIP: Run testConversationEngine() to test again');
})();