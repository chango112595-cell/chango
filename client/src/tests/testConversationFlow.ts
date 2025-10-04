/**
 * Test Script for Conversation Engine Event Flow
 * Tests userTextSubmitted -> gate -> conversation -> changoResponse flow
 * Enhanced with comprehensive debugging
 */

export async function testConversationFlow() {
  console.log('\n🧪 === CONVERSATION FLOW TEST ===\n');
  console.log('Timestamp:', new Date().toISOString());
  
  // Test variables
  let changoResponseReceived = false;
  let responseText = '';
  let testsPassed = 0;
  let totalTests = 0;
  
  // Check if required modules are loaded
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  const listeningGate = (window as any).listeningGate;
  
  console.log('\n📋 MODULE CHECK:');
  
  if (!voiceBus) {
    console.error('❌ voiceBus not available!');
    console.log('   Attempting to access window.voiceBus...');
    console.log('   window.voiceBus =', (window as any).voiceBus);
    return { passed: 0, total: 0, error: 'voiceBus not available' };
  }
  console.log('✅ voiceBus loaded');
  
  if (!conversationEngine) {
    console.error('❌ conversationEngine not available!');
    console.log('   Attempting to access window.conversationEngine...');
    console.log('   window.conversationEngine =', (window as any).conversationEngine);
    return { passed: 0, total: 0, error: 'conversationEngine not available' };
  }
  console.log('✅ conversationEngine loaded');
  console.log('   Available functions:', Object.keys(conversationEngine));
  
  if (!listeningGate) {
    console.error('❌ listeningGate not available!');
    console.log('   Attempting to access window.listeningGate...');
    console.log('   window.listeningGate =', (window as any).listeningGate);
    return { passed: 0, total: 0, error: 'listeningGate not available' };
  }
  console.log('✅ listeningGate loaded');
  
  // Check conversation engine listeners
  if (conversationEngine.checkListeners) {
    const listeners = conversationEngine.checkListeners();
    console.log('\n📻 CONVERSATION ENGINE LISTENERS:');
    console.log('   userSpeechRecognized:', listeners.userSpeechRecognized ? '✅' : '❌');
    console.log('   userTextSubmitted:', listeners.userTextSubmitted ? '✅' : '❌');
    console.log('   cancel:', listeners.cancel ? '✅' : '❌');
    console.log('   muteChange:', listeners.muteChange ? '✅' : '❌');
  }
  
  console.log('\n✅ All required modules loaded and ready');
  
  // Set up changoResponse listener with detailed logging
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    changoResponseReceived = true;
    responseText = event.text;
    console.log('🎉 changoResponse EVENT RECEIVED!');
    console.log('   Event details:', JSON.stringify(event));
    console.log('   Response text:', responseText);
    console.log('   Source:', event.source);
  });
  
  // TEST 1: Test without wake word (should be blocked)
  console.log('\n📝 Test 1: Message WITHOUT wake word');
  console.log('   Input: "what time is it"');
  console.log('   Expected: Message blocked by gate, no response');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Check gate result
  const gateResult1 = listeningGate.passGate('what time is it', true);
  console.log('   Gate result:', JSON.stringify(gateResult1));
  
  // Emit the event
  console.log('   Emitting userTextSubmitted event...');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'what time is it',
    source: 'user'
  });
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!changoResponseReceived && !gateResult1.allowed) {
    console.log('✅ Test 1 PASSED: Message correctly blocked by gate');
    testsPassed++;
  } else {
    console.error('❌ Test 1 FAILED: Message should have been blocked');
    console.error('   Gate allowed:', gateResult1.allowed);
    console.error('   Response received:', changoResponseReceived);
    if (changoResponseReceived) {
      console.error('   Unexpected response:', responseText);
    }
  }
  
  // TEST 2: Test with wake word (should pass and get response)
  console.log('\n📝 Test 2: Message WITH wake word');
  console.log('   Input: "lolo what time is it"');
  console.log('   Expected: Message passes gate, gets time response');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Check gate result
  const gateResult2 = listeningGate.passGate('lolo what time is it', true);
  console.log('   Gate result:', JSON.stringify(gateResult2));
  
  // Emit the event
  console.log('   Emitting userTextSubmitted event with wake word...');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo what time is it',
    source: 'user'
  });
  
  // Wait for response
  console.log('   Waiting for changoResponse event (1 second)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (changoResponseReceived && gateResult2.allowed) {
    console.log('✅ Test 2 PASSED: Message passed gate and got response');
    console.log('   Response received:', responseText);
    if (responseText.toLowerCase().includes('time')) {
      console.log('   Response correctly contains time information ✓');
    }
    testsPassed++;
  } else {
    console.error('❌ Test 2 FAILED: Should have received changoResponse');
    console.error('   Gate allowed:', gateResult2.allowed);
    console.error('   Gate reason:', gateResult2.reason);
    console.error('   Response received:', changoResponseReceived);
    if (changoResponseReceived) {
      console.error('   Response text:', responseText);
    } else {
      console.error('   NO RESPONSE RECEIVED - Check conversation engine!');
    }
  }
  
  // TEST 3: Test with just wake word (should get acknowledgment)
  console.log('\n📝 Test 3: Just wake word alone');
  console.log('   Input: "lolo"');
  console.log('   Expected: Gets acknowledgment ("Yes?")');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Check gate result
  const gateResult3 = listeningGate.passGate('lolo', true);
  console.log('   Gate result:', JSON.stringify(gateResult3));
  
  // Emit the event
  console.log('   Emitting userTextSubmitted event with just wake word...');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo',
    source: 'user'
  });
  
  // Wait for response
  console.log('   Waiting for changoResponse event (1 second)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (changoResponseReceived && gateResult3.allowed) {
    console.log('✅ Test 3 PASSED: Wake word ping got acknowledgment');
    console.log('   Response:', responseText);
    if (responseText === 'Yes?') {
      console.log('   Response is correct acknowledgment ✓');
    }
    testsPassed++;
  } else {
    console.error('❌ Test 3 FAILED: Should have received acknowledgment');
    console.error('   Gate allowed:', gateResult3.allowed);
    console.error('   Gate reason:', gateResult3.reason);
    console.error('   Response received:', changoResponseReceived);
    if (changoResponseReceived) {
      console.error('   Response text:', responseText);
    } else {
      console.error('   NO ACKNOWLEDGMENT - Check ping handling!');
    }
  }
  
  // TEST 4: Test conversation engine routing directly
  console.log('\n📝 Test 4: Direct conversation engine routing');
  console.log('   Testing route function with "what time is it"');
  console.log('   Expected: Returns time string');
  
  totalTests++;
  const routeResult = conversationEngine.route('what time is it');
  console.log('   Route result:', routeResult);
  
  if (routeResult && routeResult.includes('time')) {
    console.log('✅ Test 4 PASSED: Routing function works correctly');
    testsPassed++;
  } else {
    console.error('❌ Test 4 FAILED: Routing should return time response');
    console.error('   Got:', routeResult);
  }
  
  // TEST 5: Test conversation engine handle function directly  
  console.log('\n📝 Test 5: Direct conversation engine handle');
  console.log('   Testing handle function with "lolo what date is today"');
  console.log('   Expected: Emits changoResponse with date');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Call handle directly
  console.log('   Calling conversationEngine.handle() directly...');
  await conversationEngine.handle('lolo what date is today', true);
  
  // Wait for response
  console.log('   Waiting for changoResponse event (1 second)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (changoResponseReceived && responseText.includes('Today')) {
    console.log('✅ Test 5 PASSED: Handle function works correctly');
    console.log('   Response:', responseText);
    testsPassed++;
  } else {
    console.error('❌ Test 5 FAILED: Handle should generate date response');
    console.error('   Response received:', changoResponseReceived);
    if (changoResponseReceived) {
      console.error('   Response text:', responseText);
    } else {
      console.error('   NO RESPONSE FROM HANDLE - Check respond() function!');
    }
  }
  
  // TEST 6: Test voice input simulation
  console.log('\n📝 Test 6: Voice input simulation');
  console.log('   Simulating userSpeechRecognized with "lolo hello"');
  console.log('   Expected: Gets greeting response');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Emit speech recognized event
  console.log('   Emitting userSpeechRecognized event...');
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'lolo hello',
    source: 'user'
  });
  
  // Wait for response
  console.log('   Waiting for changoResponse event (1 second)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (changoResponseReceived) {
    console.log('✅ Test 6 PASSED: Voice input processed correctly');
    console.log('   Response:', responseText);
    testsPassed++;
  } else {
    console.error('❌ Test 6 FAILED: Voice input should trigger response');
    console.error('   Response received:', changoResponseReceived);
  }
  
  // Clean up
  unsubscribe();
  
  // Summary
  console.log('\n📊 === TEST SUMMARY ===');
  console.log(`Tests passed: ${testsPassed}/${totalTests}`);
  
  const allPassed = testsPassed === totalTests;
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Conversation flow is working correctly.');
    console.log('   ✅ Gate filtering is working');
    console.log('   ✅ Wake word detection is working');
    console.log('   ✅ Conversation engine is generating responses');
    console.log('   ✅ changoResponse events are being emitted');
    console.log('   ✅ Both text and voice inputs work correctly');
  } else {
    console.error('\n❌ SOME TESTS FAILED!');
    console.error('   Issues detected in conversation flow');
    console.error('   Check the failed tests above for details');
    
    // Provide diagnostic hints
    console.log('\n🔍 DIAGNOSTIC HINTS:');
    if (!conversationEngine) {
      console.error('   - Conversation engine not exposed: Check initConversationEngine()');
    }
    if (testsPassed < 2) {
      console.error('   - changoResponse events not received: Check respond() function');
      console.error('   - Check if responder service is returning responses');
    }
    if (testsPassed === 1) {
      console.error('   - Gate blocking works but responses fail: Check event chain');
    }
  }
  
  return { 
    passed: testsPassed, 
    total: totalTests,
    success: allPassed,
    details: {
      gateBlocking: testsPassed >= 1,
      wakeWordProcessing: testsPassed >= 2,
      acknowledgments: testsPassed >= 3,
      routing: testsPassed >= 4,
      directHandle: testsPassed >= 5,
      voiceInput: testsPassed >= 6
    }
  };
}

// Quick test function
export async function quickTest() {
  console.log('\n🚀 QUICK TEST - Testing "lolo what time is it"');
  
  const voiceBus = (window as any).voiceBus;
  if (!voiceBus) {
    console.error('voiceBus not available!');
    return;
  }
  
  let gotResponse = false;
  const unsub = voiceBus.on('changoResponse', (event: any) => {
    console.log('✅ Got changoResponse:', event.text);
    gotResponse = true;
  });
  
  console.log('Emitting: "lolo what time is it"');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo what time is it',
    source: 'user'
  });
  
  await new Promise(r => setTimeout(r, 1000));
  unsub();
  
  if (!gotResponse) {
    console.error('❌ No response received!');
    console.log('Check console for [ConversationEngine] logs');
  }
  
  return gotResponse;
}

// Expose test functions to window
if (import.meta.env.DEV) {
  (window as any).testConversationFlow = testConversationFlow;
  (window as any).quickTest = quickTest;
  console.log('[TestConversationFlow] Test functions exposed to window:');
  console.log('  - testConversationFlow() - Full test suite');
  console.log('  - quickTest() - Quick single test');
}