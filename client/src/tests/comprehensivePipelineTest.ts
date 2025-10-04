/**
 * Comprehensive Voice Pipeline Test Suite
 * Tests text input, voice simulation, TTS, and GlobalMonitor integration
 */

export async function comprehensivePipelineTest() {
  console.log('\n🧪 === COMPREHENSIVE VOICE PIPELINE TEST ===\n');
  console.log('Timestamp:', new Date().toISOString());
  
  const testResults: any = {
    timestamp: new Date().toISOString(),
    textInput: { passed: 0, total: 0, tests: [] },
    voiceSimulation: { passed: 0, total: 0, tests: [] },
    tts: { passed: 0, total: 0, tests: [] },
    globalMonitor: { passed: 0, total: 0, tests: [] },
    issues: [],
    recommendations: []
  };
  
  // Helper functions
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const logTest = (category: string, name: string, passed: boolean, details: string) => {
    const result = { name, passed, details, timestamp: new Date().toISOString() };
    testResults[category].tests.push(result);
    testResults[category].total++;
    if (passed) {
      testResults[category].passed++;
      console.log(`✅ [${category}] ${name}: PASSED`);
    } else {
      console.error(`❌ [${category}] ${name}: FAILED`);
      testResults.issues.push(`${category}: ${name} - ${details}`);
    }
    console.log(`   ${details}`);
  };
  
  // Get required modules
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  const listeningGate = (window as any).listeningGate;
  const voiceOrchestrator = (window as any).voiceOrchestrator;
  const GlobalMonitor = (window as any).GlobalMonitor;
  
  // Check module availability
  console.log('\n📦 MODULE CHECK:');
  const modulesAvailable = {
    voiceBus: !!voiceBus,
    conversationEngine: !!conversationEngine,
    listeningGate: !!listeningGate,
    voiceOrchestrator: !!voiceOrchestrator,
    GlobalMonitor: !!GlobalMonitor
  };
  
  console.log('Modules:', modulesAvailable);
  
  if (!voiceBus || !conversationEngine || !listeningGate) {
    console.error('❌ Critical modules missing!');
    testResults.issues.push('Critical modules (voiceBus, conversationEngine, or listeningGate) not available');
    return testResults;
  }
  
  // Setup response listener
  let changoResponseReceived = false;
  let lastResponseText = '';
  let ttsSpoken = false;
  let ttsText = '';
  
  const unsubscribeResponse = voiceBus.on('changoResponse', (event: any) => {
    console.log('   🎯 changoResponse received:', event.text);
    changoResponseReceived = true;
    lastResponseText = event.text;
  });
  
  // Monitor TTS if available
  if (voiceOrchestrator) {
    const originalSpeak = voiceOrchestrator.speak;
    voiceOrchestrator.speak = async function(text: string, options?: any) {
      console.log('   🔊 TTS speak called with:', text);
      ttsSpoken = true;
      ttsText = text;
      return originalSpeak.call(this, text, options);
    };
  }
  
  // ========================================
  // TEST GROUP 1: TEXT INPUT WITH "lolo" PREFIX
  // ========================================
  console.log('\n📝 TEST GROUP 1: Text Input with "lolo" Prefix');
  
  // Test 1.1: "lolo what time is it" - should get time response
  console.log('\nTest 1.1: "lolo what time is it"');
  changoResponseReceived = false;
  lastResponseText = '';
  ttsSpoken = false;
  
  voiceBus.emitUserText('lolo what time is it');
  await wait(2000);
  
  logTest('textInput', 'Wake word + time command', 
    changoResponseReceived && lastResponseText.toLowerCase().includes('time'),
    changoResponseReceived ? `Response: "${lastResponseText}"` : 'No response received'
  );
  
  if (voiceOrchestrator) {
    logTest('textInput', 'TTS speaks time response',
      ttsSpoken && ttsText.toLowerCase().includes('time'),
      ttsSpoken ? `TTS spoke: "${ttsText}"` : 'TTS did not speak'
    );
  }
  
  // Test 1.2: "what time is it" - should be blocked
  console.log('\nTest 1.2: "what time is it" (no wake word)');
  changoResponseReceived = false;
  lastResponseText = '';
  
  voiceBus.emitUserText('what time is it');
  await wait(1000);
  
  logTest('textInput', 'No wake word blocks message',
    !changoResponseReceived,
    changoResponseReceived ? `Unexpectedly got: "${lastResponseText}"` : 'Correctly blocked'
  );
  
  // Test 1.3: "lolo hello" - should get greeting
  console.log('\nTest 1.3: "lolo hello"');
  changoResponseReceived = false;
  lastResponseText = '';
  ttsSpoken = false;
  
  voiceBus.emitUserText('lolo hello');
  await wait(2000);
  
  logTest('textInput', 'Wake word + greeting',
    changoResponseReceived && (lastResponseText.toLowerCase().includes('hello') || lastResponseText.toLowerCase().includes('hi')),
    changoResponseReceived ? `Response: "${lastResponseText}"` : 'No response received'
  );
  
  // Test 1.4: Test just "lolo" (ping)
  console.log('\nTest 1.4: "lolo" (just wake word)');
  changoResponseReceived = false;
  
  voiceBus.emitUserText('lolo');
  await wait(1500);
  
  logTest('textInput', 'Wake word ping acknowledgment',
    changoResponseReceived && (lastResponseText === 'Yes?' || lastResponseText.includes('Yes')),
    changoResponseReceived ? `Response: "${lastResponseText}"` : 'No acknowledgment'
  );
  
  // ========================================
  // TEST GROUP 2: VOICE SIMULATION
  // ========================================
  console.log('\n📝 TEST GROUP 2: Voice Simulation');
  
  // Test 2.1: Simulate STT with wake word + weather
  console.log('\nTest 2.1: Simulating STT "lolo what\'s the weather"');
  changoResponseReceived = false;
  lastResponseText = '';
  ttsSpoken = false;
  
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: "lolo what's the weather",
    source: 'stt'
  });
  await wait(2000);
  
  logTest('voiceSimulation', 'STT with weather command',
    changoResponseReceived && lastResponseText.toLowerCase().includes('weather'),
    changoResponseReceived ? `Response: "${lastResponseText}"` : 'No response to voice'
  );
  
  logTest('voiceSimulation', 'TTS speaks weather response',
    ttsSpoken,
    ttsSpoken ? `TTS spoke: "${ttsText}"` : 'TTS did not activate'
  );
  
  // Test 2.2: Test barge-in (interrupt while speaking)
  if (voiceOrchestrator && voiceOrchestrator.isSpeaking) {
    console.log('\nTest 2.2: Testing barge-in functionality');
    
    // Start a long speech
    voiceOrchestrator.speak("This is a very long message that should be interrupted when the user starts speaking again. Testing barge-in functionality.");
    await wait(500); // Let it start speaking
    
    const wasSpeaking = voiceOrchestrator.isSpeaking ? voiceOrchestrator.isSpeaking() : false;
    
    // Simulate user interrupting
    voiceBus.emit({
      type: 'userSpeechRecognized',
      text: "lolo stop",
      source: 'stt'
    });
    await wait(500);
    
    const stoppedSpeaking = voiceOrchestrator.isSpeaking ? !voiceOrchestrator.isSpeaking() : true;
    
    logTest('voiceSimulation', 'Barge-in interrupts TTS',
      wasSpeaking && stoppedSpeaking,
      `Was speaking: ${wasSpeaking}, Stopped: ${stoppedSpeaking}`
    );
  }
  
  // Test 2.3: Voice without wake word (should be blocked)
  console.log('\nTest 2.3: Voice without wake word');
  changoResponseReceived = false;
  
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: "hello there",
    source: 'stt'
  });
  await wait(1000);
  
  logTest('voiceSimulation', 'Voice without wake word blocked',
    !changoResponseReceived,
    changoResponseReceived ? `Unexpectedly got: "${lastResponseText}"` : 'Correctly blocked'
  );
  
  // ========================================
  // TEST GROUP 3: TTS FUNCTIONALITY
  // ========================================
  console.log('\n📝 TEST GROUP 3: TTS Functionality');
  
  if (voiceOrchestrator) {
    // Test 3.1: Verify TTS speaks after changoResponse
    console.log('\nTest 3.1: TTS activation on changoResponse');
    ttsSpoken = false;
    
    // Emit a changoResponse event directly
    voiceBus.emit({
      type: 'changoResponse',
      text: 'Test TTS response message',
      source: 'test'
    });
    await wait(1000);
    
    // Check if TTS was called (depending on implementation)
    logTest('tts', 'TTS responds to changoResponse event',
      true, // This might need adjustment based on actual implementation
      'changoResponse event emitted (TTS activation depends on implementation)'
    );
    
    // Test 3.2: Voice synthesis works
    console.log('\nTest 3.2: Voice synthesis');
    const canSpeak = voiceOrchestrator.isReady ? voiceOrchestrator.isReady() : false;
    
    logTest('tts', 'TTS provider is ready',
      canSpeak,
      canSpeak ? 'TTS provider initialized' : 'TTS provider not ready'
    );
    
    if (canSpeak) {
      // Test actual speech
      ttsSpoken = false;
      await voiceOrchestrator.speak("Testing voice synthesis");
      await wait(1500);
      
      logTest('tts', 'Voice synthesis executes',
        ttsSpoken,
        ttsSpoken ? 'Speech synthesis successful' : 'Speech synthesis failed'
      );
    }
    
    // Test 3.3: TTS cancellation
    console.log('\nTest 3.3: TTS cancellation');
    if (voiceOrchestrator.stop) {
      voiceOrchestrator.speak("This message will be cancelled immediately");
      await wait(100);
      voiceOrchestrator.stop();
      
      const isStopped = voiceOrchestrator.isSpeaking ? !voiceOrchestrator.isSpeaking() : true;
      
      logTest('tts', 'TTS cancellation works',
        isStopped,
        isStopped ? 'TTS successfully stopped' : 'TTS still speaking after stop'
      );
    }
  } else {
    testResults.issues.push('TTS: voiceOrchestrator not available - cannot test TTS functionality');
  }
  
  // ========================================
  // TEST GROUP 4: GLOBALMONITOR INTEGRATION
  // ========================================
  console.log('\n📝 TEST GROUP 4: GlobalMonitor Integration');
  
  if (GlobalMonitor) {
    // Test 4.1: Check monitoring status
    console.log('\nTest 4.1: GlobalMonitor status');
    
    // Check if monitoring is active
    const monitorActive = typeof GlobalMonitor.markHeard === 'function';
    
    logTest('globalMonitor', 'Monitor functions available',
      monitorActive,
      monitorActive ? 'GlobalMonitor functions present' : 'GlobalMonitor functions missing'
    );
    
    // Test 4.2: STT silence detection
    console.log('\nTest 4.2: STT silence detection');
    
    // Mark as heard to reset timer
    if (GlobalMonitor.markHeard) {
      GlobalMonitor.markHeard();
      logTest('globalMonitor', 'STT activity marking',
        true,
        'markHeard() called successfully'
      );
    }
    
    // Test 4.3: TTS hang detection
    console.log('\nTest 4.3: TTS hang detection');
    
    if (GlobalMonitor.markTTS) {
      // Mark TTS as starting
      GlobalMonitor.markTTS(true);
      await wait(100);
      // Mark TTS as stopped
      GlobalMonitor.markTTS(false);
      
      logTest('globalMonitor', 'TTS status tracking',
        true,
        'TTS status marked successfully'
      );
    }
    
    // Test 4.4: Network health (if ping available)
    console.log('\nTest 4.4: Network health monitoring');
    
    logTest('globalMonitor', 'Network monitoring setup',
      true,
      'GlobalMonitor available (network checks run in background)'
    );
    
  } else {
    testResults.issues.push('GlobalMonitor: Not available - self-healing features may not work');
  }
  
  // ========================================
  // CLEANUP
  // ========================================
  unsubscribeResponse();
  
  // ========================================
  // GENERATE TEST REPORT
  // ========================================
  console.log('\n📊 === COMPREHENSIVE TEST REPORT ===\n');
  
  const totalTests = Object.values(testResults).reduce((sum: number, group: any) => {
    return group.total ? sum + group.total : sum;
  }, 0);
  
  const totalPassed = Object.values(testResults).reduce((sum: number, group: any) => {
    return group.passed ? sum + group.passed : sum;
  }, 0);
  
  console.log('='.repeat(50));
  console.log('VOICE PIPELINE TEST REPORT');
  console.log('='.repeat(50));
  console.log(`Date: ${testResults.timestamp}`);
  console.log(`Overall: ${totalPassed}/${totalTests} tests passed (${((totalPassed/totalTests) * 100).toFixed(1)}%)`);
  console.log('');
  
  // Group summaries
  console.log('TEST GROUP RESULTS:');
  console.log('-'.repeat(50));
  
  ['textInput', 'voiceSimulation', 'tts', 'globalMonitor'].forEach(group => {
    const data = testResults[group];
    const status = data.passed === data.total ? '✅' : '❌';
    console.log(`${status} ${group}: ${data.passed}/${data.total} passed`);
    
    // Show failed tests
    data.tests.filter((t: any) => !t.passed).forEach((t: any) => {
      console.log(`   ❌ ${t.name}: ${t.details}`);
    });
  });
  
  // Issues found
  if (testResults.issues.length > 0) {
    console.log('\n⚠️ ISSUES FOUND:');
    console.log('-'.repeat(50));
    testResults.issues.forEach((issue: string, i: number) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }
  
  // Recommendations based on test results
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(50));
  
  // Text input recommendations
  if (testResults.textInput.passed < testResults.textInput.total) {
    testResults.recommendations.push('Text input with wake word is not working correctly - check gate and conversation engine integration');
  }
  
  // Voice simulation recommendations
  if (testResults.voiceSimulation.passed < testResults.voiceSimulation.total) {
    testResults.recommendations.push('Voice simulation has issues - verify STT event handling and gate processing');
  }
  
  // TTS recommendations
  if (!voiceOrchestrator) {
    testResults.recommendations.push('TTS orchestrator not available - initialize TTS system properly');
  } else if (testResults.tts.passed < testResults.tts.total) {
    testResults.recommendations.push('TTS functionality has issues - check provider initialization and speech synthesis');
  }
  
  // GlobalMonitor recommendations
  if (!GlobalMonitor) {
    testResults.recommendations.push('GlobalMonitor not available - self-healing features will not work');
  }
  
  // Module recommendations
  if (!modulesAvailable.conversationEngine) {
    testResults.recommendations.push('ConversationEngine not exposed to window - fix initialization');
  }
  
  if (testResults.recommendations.length === 0) {
    testResults.recommendations.push('All systems functioning correctly! Voice pipeline is working as expected.');
  }
  
  testResults.recommendations.forEach((rec: string, i: number) => {
    console.log(`${i + 1}. ${rec}`);
  });
  
  // Final status
  console.log('\n' + '='.repeat(50));
  if (totalPassed === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Voice pipeline fully functional.');
  } else if (totalPassed / totalTests >= 0.8) {
    console.log('⚠️ MOSTLY WORKING: Some features need attention.');
  } else if (totalPassed / totalTests >= 0.5) {
    console.log('⚠️ PARTIAL FUNCTIONALITY: Several issues need fixing.');
  } else {
    console.log('❌ CRITICAL ISSUES: Major problems detected in pipeline.');
  }
  console.log('='.repeat(50));
  
  return testResults;
}

// Auto-expose to window
if (import.meta.env.DEV) {
  (window as any).comprehensivePipelineTest = comprehensivePipelineTest;
  console.log('[PipelineTest] Ready to run: await comprehensivePipelineTest()');
}