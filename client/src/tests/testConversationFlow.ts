/**
 * Test Script for Conversation Engine Event Flow
 * Tests userTextSubmitted -> gate -> conversation -> changoResponse flow
 */

export async function testConversationFlow() {
  console.log('\n🧪 === CONVERSATION FLOW TEST ===\n');
  
  // Test variables
  let changoResponseReceived = false;
  let responseText = '';
  let testsPassed = 0;
  let totalTests = 0;
  
  // Check if required modules are loaded
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  const listeningGate = (window as any).listeningGate;
  
  if (!voiceBus) {
    console.error('❌ voiceBus not available!');
    return;
  }
  
  if (!conversationEngine) {
    console.error('❌ conversationEngine not available!');
    return;
  }
  
  if (!listeningGate) {
    console.error('❌ listeningGate not available!');
    return;
  }
  
  console.log('✅ All required modules loaded');
  
  // Set up changoResponse listener
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    changoResponseReceived = true;
    responseText = event.text;
    console.log('✅ changoResponse received:', event);
    console.log('   Response text:', responseText);
  });
  
  // TEST 1: Test without wake word (should be blocked)
  console.log('\n📝 Test 1: Message WITHOUT wake word');
  console.log('   Input: "what time is it"');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Check gate result
  const gateResult1 = listeningGate.passGate('what time is it', true);
  console.log('   Gate result:', gateResult1);
  
  // Emit the event
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
  }
  
  // TEST 2: Test with wake word (should pass and get response)
  console.log('\n📝 Test 2: Message WITH wake word');
  console.log('   Input: "lolo what time is it"');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Check gate result
  const gateResult2 = listeningGate.passGate('lolo what time is it', true);
  console.log('   Gate result:', gateResult2);
  
  // Emit the event
  console.log('   Emitting userTextSubmitted event...');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo what time is it',
    source: 'user'
  });
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (changoResponseReceived && gateResult2.allowed) {
    console.log('✅ Test 2 PASSED: Message passed gate and got response');
    console.log('   Response:', responseText);
    testsPassed++;
  } else {
    console.error('❌ Test 2 FAILED: Should have received changoResponse');
    console.error('   Gate allowed:', gateResult2.allowed);
    console.error('   Response received:', changoResponseReceived);
    if (changoResponseReceived) {
      console.error('   Response text:', responseText);
    }
  }
  
  // TEST 3: Test with just wake word (should get acknowledgment)
  console.log('\n📝 Test 3: Just wake word alone');
  console.log('   Input: "lolo"');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Check gate result
  const gateResult3 = listeningGate.passGate('lolo', true);
  console.log('   Gate result:', gateResult3);
  
  // Emit the event
  console.log('   Emitting userTextSubmitted event...');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo',
    source: 'user'
  });
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (changoResponseReceived && gateResult3.allowed && gateResult3.reason === 'ping') {
    console.log('✅ Test 3 PASSED: Wake word ping got acknowledgment');
    console.log('   Response:', responseText);
    testsPassed++;
  } else {
    console.error('❌ Test 3 FAILED: Should have received acknowledgment');
    console.error('   Gate allowed:', gateResult3.allowed);
    console.error('   Gate reason:', gateResult3.reason);
    console.error('   Response received:', changoResponseReceived);
    if (changoResponseReceived) {
      console.error('   Response text:', responseText);
    }
  }
  
  // TEST 4: Test conversation engine routing directly
  console.log('\n📝 Test 4: Direct conversation engine routing');
  console.log('   Testing route function with "what time is it"');
  
  totalTests++;
  const routeResult = conversationEngine.route('what time is it');
  console.log('   Route result:', routeResult);
  
  if (routeResult && routeResult.includes('time')) {
    console.log('✅ Test 4 PASSED: Routing function works correctly');
    testsPassed++;
  } else {
    console.error('❌ Test 4 FAILED: Routing should return time response');
  }
  
  // TEST 5: Test conversation engine handle function directly  
  console.log('\n📝 Test 5: Direct conversation engine handle');
  console.log('   Testing handle function with "lolo what date is today"');
  
  totalTests++;
  changoResponseReceived = false;
  responseText = '';
  
  // Call handle directly
  await conversationEngine.handle('lolo what date is today', true);
  
  // Wait for response
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
    }
  }
  
  // Clean up
  unsubscribe();
  
  // Summary
  console.log('\n📊 === TEST SUMMARY ===');
  console.log(`Tests passed: ${testsPassed}/${totalTests}`);
  
  if (testsPassed === totalTests) {
    console.log('✅ ALL TESTS PASSED! Conversation flow is working correctly.');
    console.log('   - Gate filtering is working');
    console.log('   - Wake word detection is working');
    console.log('   - Conversation engine is generating responses');
    console.log('   - changoResponse events are being emitted');
  } else {
    console.error('❌ SOME TESTS FAILED!');
    console.error('   Issues detected in conversation flow');
    console.error('   Check the failed tests above for details');
  }
  
  return { passed: testsPassed, total: totalTests };
}

// Expose test function to window
if (import.meta.env.DEV) {
  (window as any).testConversationFlow = testConversationFlow;
  console.log('[TestConversationFlow] Test function exposed to window.testConversationFlow()');
  console.log('[TestConversationFlow] Run with: await testConversationFlow()');
}