/**
 * Comprehensive Wake Word Test Suite
 * Tests all aspects of wake word functionality
 */

export async function comprehensiveWakeWordTest() {
  console.log('\n🧪 === COMPREHENSIVE WAKE WORD TEST SUITE ===\n');
  
  let testsPassed = 0;
  let totalTests = 0;
  const testResults: any[] = [];
  
  // Helper function to wait
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Helper function to log test result
  const logTestResult = (name: string, passed: boolean, details: string) => {
    totalTests++;
    if (passed) {
      testsPassed++;
      console.log(`✅ ${name}: PASSED`);
    } else {
      console.error(`❌ ${name}: FAILED`);
    }
    console.log(`   ${details}`);
    testResults.push({ name, passed, details });
  };
  
  // Check if modules are available
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  const listeningGate = (window as any).listeningGate;
  const responder = (window as any).responder;
  
  console.log('📦 Module Availability Check:');
  logTestResult(
    'VoiceBus Available',
    !!voiceBus,
    voiceBus ? 'VoiceBus module loaded' : 'VoiceBus module NOT found'
  );
  
  logTestResult(
    'ConversationEngine Available',
    !!conversationEngine,
    conversationEngine ? 'ConversationEngine exposed to window' : 'ConversationEngine NOT exposed - check initialization'
  );
  
  logTestResult(
    'ListeningGate Available',
    !!listeningGate,
    listeningGate ? 'ListeningGate module loaded' : 'ListeningGate module NOT found'
  );
  
  logTestResult(
    'Responder Available',
    !!responder,
    responder ? 'Responder service loaded' : 'Responder service NOT found'
  );
  
  if (!voiceBus || !listeningGate) {
    console.error('\n❌ CRITICAL: Required modules not available!');
    return { testsPassed, totalTests, testResults };
  }
  
  // Test 1: Gate Functionality
  console.log('\n📝 TEST GROUP 1: Gate Functionality');
  
  if (listeningGate) {
    // Test 1a: Without wake word
    const gateTest1 = listeningGate.passGate('what time is it', true);
    logTestResult(
      'Gate blocks without wake word',
      !gateTest1.allowed,
      `Input: "what time is it" → Allowed: ${gateTest1.allowed}, Reason: ${gateTest1.reason}`
    );
    
    // Test 1b: With wake word
    const gateTest2 = listeningGate.passGate('lolo what time is it', true);
    logTestResult(
      'Gate allows with wake word',
      gateTest2.allowed,
      `Input: "lolo what time is it" → Allowed: ${gateTest2.allowed}, Processed text: "${gateTest2.text}"`
    );
    
    // Test 1c: Just wake word (ping)
    const gateTest3 = listeningGate.passGate('lolo', true);
    logTestResult(
      'Gate detects wake word ping',
      gateTest3.allowed && gateTest3.reason === 'ping',
      `Input: "lolo" → Allowed: ${gateTest3.allowed}, Reason: ${gateTest3.reason}`
    );
    
    // Test 1d: Wake word in middle (should not work)
    const gateTest4 = listeningGate.passGate('hey lolo what time', true);
    logTestResult(
      'Gate requires wake word at start',
      !gateTest4.allowed,
      `Input: "hey lolo what time" → Allowed: ${gateTest4.allowed}, Reason: ${gateTest4.reason}`
    );
  }
  
  // Test 2: VoiceBus Event Flow
  console.log('\n📝 TEST GROUP 2: VoiceBus Event Flow');
  
  let changoResponseReceived = false;
  let lastResponseText = '';
  
  // Set up listener for changoResponse
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    console.log('   🎉 changoResponse event received:', event.text);
    changoResponseReceived = true;
    lastResponseText = event.text;
  });
  
  // Test 2a: Message without wake word (should be blocked)
  console.log('\n   Testing: "what time is it" (no wake word)');
  changoResponseReceived = false;
  voiceBus.emitUserText('what time is it');
  await wait(1000);
  
  logTestResult(
    'Message without wake word blocked',
    !changoResponseReceived,
    changoResponseReceived ? `Got unexpected response: "${lastResponseText}"` : 'No response (correctly blocked)'
  );
  
  // Test 2b: Message with wake word (should get response)
  console.log('\n   Testing: "lolo what time is it"');
  changoResponseReceived = false;
  voiceBus.emitUserText('lolo what time is it');
  await wait(2000);
  
  logTestResult(
    'Message with wake word gets response',
    changoResponseReceived && lastResponseText.toLowerCase().includes('time'),
    changoResponseReceived ? `Got response: "${lastResponseText}"` : 'No response received'
  );
  
  // Test 2c: Just wake word (should get acknowledgment)
  console.log('\n   Testing: "lolo" (just wake word)');
  changoResponseReceived = false;
  voiceBus.emitUserText('lolo');
  await wait(1500);
  
  logTestResult(
    'Wake word alone gets acknowledgment',
    changoResponseReceived,
    changoResponseReceived ? `Got acknowledgment: "${lastResponseText}"` : 'No acknowledgment received'
  );
  
  // Test 2d: Different command with wake word
  console.log('\n   Testing: "lolo what is today"');
  changoResponseReceived = false;
  voiceBus.emitUserText('lolo what is today');
  await wait(2000);
  
  logTestResult(
    'Date command with wake word works',
    changoResponseReceived && (lastResponseText.toLowerCase().includes('today') || lastResponseText.toLowerCase().includes('date')),
    changoResponseReceived ? `Got response: "${lastResponseText}"` : 'No response received'
  );
  
  // Test 3: Direct ConversationEngine Functions (if available)
  if (conversationEngine) {
    console.log('\n📝 TEST GROUP 3: ConversationEngine Direct Functions');
    
    // Test 3a: Route function
    const routeResult = conversationEngine.route('what time is it');
    logTestResult(
      'Route function returns time',
      routeResult && routeResult.includes('time'),
      routeResult ? `Route result: "${routeResult}"` : 'No route result'
    );
    
    // Test 3b: Handle function with wake word
    console.log('\n   Testing handle() with wake word');
    changoResponseReceived = false;
    await conversationEngine.handle('lolo hello', true);
    await wait(1500);
    
    logTestResult(
      'Handle function processes wake word',
      changoResponseReceived,
      changoResponseReceived ? `Response: "${lastResponseText}"` : 'No response from handle()'
    );
  }
  
  // Test 4: Responder Service (if available)
  if (responder) {
    console.log('\n📝 TEST GROUP 4: Responder Service');
    
    const responderResponse = await responder.respond('what time is it', {
      source: 'text',
      responseType: 'text'
    });
    
    logTestResult(
      'Responder generates response',
      !!responderResponse,
      responderResponse ? `Response: "${responderResponse}"` : 'No response from responder'
    );
  }
  
  // Test 5: Voice Simulation (STT input)
  console.log('\n📝 TEST GROUP 5: Voice Input Simulation');
  
  // Simulate voice recognition with wake word
  console.log('\n   Simulating voice: "lolo hello"');
  changoResponseReceived = false;
  
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'lolo hello',
    source: 'stt'
  });
  await wait(2000);
  
  logTestResult(
    'Voice input with wake word works',
    changoResponseReceived,
    changoResponseReceived ? `Response: "${lastResponseText}"` : 'No response to voice input'
  );
  
  // Simulate voice recognition without wake word
  console.log('\n   Simulating voice: "hello" (no wake word)');
  changoResponseReceived = false;
  
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'hello',
    source: 'stt'
  });
  await wait(1000);
  
  logTestResult(
    'Voice input without wake word blocked',
    !changoResponseReceived,
    changoResponseReceived ? `Got unexpected response: "${lastResponseText}"` : 'Correctly blocked'
  );
  
  // Clean up
  unsubscribe();
  
  // Final Summary
  console.log('\n📊 === TEST SUMMARY ===');
  console.log(`Tests Passed: ${testsPassed}/${totalTests}`);
  console.log(`Success Rate: ${((testsPassed/totalTests) * 100).toFixed(1)}%\n`);
  
  if (testsPassed === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Wake word functionality is working perfectly.');
  } else {
    console.error('❌ SOME TESTS FAILED. Review the results above for details.');
    console.log('\n📋 Failed Tests:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.error(`   - ${r.name}: ${r.details}`);
    });
  }
  
  // Check for specific issues
  if (!conversationEngine) {
    console.error('\n⚠️ CRITICAL ISSUE: ConversationEngine not exposed to window!');
    console.error('   This needs to be fixed in the initialization code.');
  }
  
  return { testsPassed, totalTests, testResults };
}

// Auto-expose to window
if (import.meta.env.DEV) {
  (window as any).comprehensiveWakeWordTest = comprehensiveWakeWordTest;
  console.log('[ComprehensiveTest] Ready to run: await comprehensiveWakeWordTest()');
}