// === WAKE WORD TEST SCRIPT ===
// Copy and paste this entire script into the browser console to test wake word functionality

(async function() {
  console.clear();
  console.log('🧪 === WAKE WORD FUNCTIONALITY TEST ===');
  console.log('Testing wake word: "lolo"');
  console.log('========================================\n');
  
  // Check module availability
  const modules = {
    voiceBus: window.voiceBus,
    conversationEngine: window.conversationEngine,
    listeningGate: window.listeningGate,
    responder: window.responder
  };
  
  console.log('📦 Module Availability Check:');
  Object.entries(modules).forEach(([name, module]) => {
    console.log(`  ${name}: ${module ? '✅ Available' : '❌ Not Available'}`);
  });
  
  if (!modules.voiceBus) {
    console.error('\n❌ CRITICAL: voiceBus not available! Cannot run tests.');
    return;
  }
  
  // Helper function to wait
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Track responses
  let testResults = [];
  let responseCount = 0;
  
  // Set up response listener
  const unsubscribe = modules.voiceBus.on('changoResponse', (event) => {
    responseCount++;
    console.log(`   🎉 [Response ${responseCount}] changoResponse received:`, event.text);
  });
  
  console.log('\n🔍 Starting Tests...\n');
  
  // Test 1: Without wake word (should be blocked)
  console.log('📝 TEST 1: Message WITHOUT wake word');
  console.log('   Input: "what time is it"');
  console.log('   Expected: No response (blocked by gate)');
  let prevCount = responseCount;
  modules.voiceBus.emitUserText('what time is it');
  await wait(1500);
  if (responseCount === prevCount) {
    console.log('   ✅ PASSED: Message correctly blocked');
    testResults.push({ test: 1, passed: true });
  } else {
    console.log('   ❌ FAILED: Message should have been blocked');
    testResults.push({ test: 1, passed: false });
  }
  
  // Test 2: With wake word (should get response)
  console.log('\n📝 TEST 2: Message WITH wake word');
  console.log('   Input: "lolo what time is it"');
  console.log('   Expected: Response with current time');
  prevCount = responseCount;
  modules.voiceBus.emitUserText('lolo what time is it');
  await wait(2000);
  if (responseCount > prevCount) {
    console.log('   ✅ PASSED: Got response with wake word');
    testResults.push({ test: 2, passed: true });
  } else {
    console.log('   ❌ FAILED: Should have received response');
    testResults.push({ test: 2, passed: false });
  }
  
  // Test 3: Just wake word (should get acknowledgment)
  console.log('\n📝 TEST 3: Just wake word alone');
  console.log('   Input: "lolo"');
  console.log('   Expected: Acknowledgment response (e.g., "Yes?")');
  prevCount = responseCount;
  modules.voiceBus.emitUserText('lolo');
  await wait(1500);
  if (responseCount > prevCount) {
    console.log('   ✅ PASSED: Got acknowledgment for wake word');
    testResults.push({ test: 3, passed: true });
  } else {
    console.log('   ❌ FAILED: Should have received acknowledgment');
    testResults.push({ test: 3, passed: false });
  }
  
  // Test 4: Different command with wake word
  console.log('\n📝 TEST 4: Different command with wake word');
  console.log('   Input: "lolo what is today"');
  console.log('   Expected: Response with current date');
  prevCount = responseCount;
  modules.voiceBus.emitUserText('lolo what is today');
  await wait(2000);
  if (responseCount > prevCount) {
    console.log('   ✅ PASSED: Got response for date command');
    testResults.push({ test: 4, passed: true });
  } else {
    console.log('   ❌ FAILED: Should have received date response');
    testResults.push({ test: 4, passed: false });
  }
  
  // Test 5: Voice input simulation with wake word
  console.log('\n📝 TEST 5: Voice input WITH wake word');
  console.log('   Simulating STT: "lolo hello"');
  console.log('   Expected: Greeting response');
  prevCount = responseCount;
  modules.voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'lolo hello',
    source: 'stt'
  });
  await wait(2000);
  if (responseCount > prevCount) {
    console.log('   ✅ PASSED: Voice input with wake word processed');
    testResults.push({ test: 5, passed: true });
  } else {
    console.log('   ❌ FAILED: Voice input should have been processed');
    testResults.push({ test: 5, passed: false });
  }
  
  // Test 6: Voice input without wake word
  console.log('\n📝 TEST 6: Voice input WITHOUT wake word');
  console.log('   Simulating STT: "hello"');
  console.log('   Expected: No response (blocked)');
  prevCount = responseCount;
  modules.voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'hello',
    source: 'stt'
  });
  await wait(1500);
  if (responseCount === prevCount) {
    console.log('   ✅ PASSED: Voice input correctly blocked');
    testResults.push({ test: 6, passed: true });
  } else {
    console.log('   ❌ FAILED: Voice input should have been blocked');
    testResults.push({ test: 6, passed: false });
  }
  
  // Test Gate directly if available
  if (modules.listeningGate) {
    console.log('\n📝 TEST 7: Direct Gate Testing');
    
    const gateTests = [
      { input: 'what time is it', shouldPass: false },
      { input: 'lolo what time is it', shouldPass: true },
      { input: 'lolo', shouldPass: true },
      { input: 'hey lolo what time', shouldPass: false }
    ];
    
    gateTests.forEach((test, i) => {
      const result = modules.listeningGate.passGate(test.input, true);
      const passed = result.allowed === test.shouldPass;
      console.log(`   ${passed ? '✅' : '❌'} "${test.input}" → ${result.allowed ? 'PASSED' : 'BLOCKED'} (expected: ${test.shouldPass ? 'PASS' : 'BLOCK'})`);
      testResults.push({ test: `7.${i+1}`, passed });
    });
  }
  
  // Clean up
  unsubscribe();
  
  // Final Summary
  console.log('\n========================================');
  console.log('📊 === TEST SUMMARY ===');
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  console.log(`Tests Passed: ${passedCount}/${totalCount}`);
  console.log(`Success Rate: ${((passedCount/totalCount) * 100).toFixed(1)}%`);
  console.log(`Total Responses Received: ${responseCount}`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED! Wake word "lolo" is working correctly!');
    console.log('✅ Messages with "lolo" are processed');
    console.log('✅ Messages without "lolo" are blocked');
    console.log('✅ Voice input with "lolo" works');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
    const failedTests = testResults.filter(r => !r.passed).map(r => r.test);
    console.log('Failed tests:', failedTests.join(', '));
  }
  
  console.log('\n========================================');
  console.log('Test complete. Check the results above.');
})();