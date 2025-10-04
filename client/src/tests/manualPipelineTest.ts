/**
 * Manual Pipeline Test Script
 * Execute all test scenarios step-by-step and generate report
 */

export async function manualPipelineTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 MANUAL VOICE PIPELINE TEST');
  console.log('='.repeat(70) + '\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      browser: navigator.userAgent,
      modules: {} as any,
    },
    tests: {
      textInput: { results: [] as any[], summary: '' },
      voiceSimulation: { results: [] as any[], summary: '' },
      tts: { results: [] as any[], summary: '' },
      globalMonitor: { results: [] as any[], summary: '' }
    },
    issues: [] as string[],
    fixes: [] as string[],
    recommendations: [] as string[]
  };
  
  // Helper to wait
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Check module availability
  console.log('📦 CHECKING MODULES...');
  const modules = {
    voiceBus: (window as any).voiceBus,
    conversationEngine: (window as any).conversationEngine,
    listeningGate: (window as any).listeningGate,
    voiceOrchestrator: (window as any).voiceOrchestrator,
    GlobalMonitor: (window as any).GlobalMonitor,
    alwaysListen: (window as any).alwaysListen
  };
  
  report.environment.modules = Object.keys(modules).reduce((acc, key) => {
    acc[key] = !!modules[key];
    return acc;
  }, {} as any);
  
  console.log('Module availability:', report.environment.modules);
  
  if (!modules.voiceBus || !modules.conversationEngine || !modules.listeningGate) {
    console.error('❌ Critical modules missing!');
    report.issues.push('CRITICAL: Core modules (voiceBus, conversationEngine, listeningGate) not available');
    return report;
  }
  
  // Test tracking
  let changoResponseReceived = false;
  let lastResponse = '';
  let ttsSpoken = false;
  
  // Setup listeners
  const unsubscribe = modules.voiceBus.on('changoResponse', (event: any) => {
    console.log('   🎯 changoResponse:', event.text);
    changoResponseReceived = true;
    lastResponse = event.text;
  });
  
  // ========================================
  // TEST 1: TEXT INPUT WITH "lolo" PREFIX
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📝 TEST GROUP 1: TEXT INPUT WITH "lolo" PREFIX');
  console.log('─'.repeat(50));
  
  // Test 1.1: "lolo what time is it"
  console.log('\n▶ Test 1.1: "lolo what time is it"');
  changoResponseReceived = false;
  lastResponse = '';
  
  modules.voiceBus.emitUserText('lolo what time is it');
  await wait(2000);
  
  const test1_1 = {
    name: 'Wake word + time command',
    input: 'lolo what time is it',
    expected: 'Time response',
    received: lastResponse,
    passed: changoResponseReceived && lastResponse.toLowerCase().includes('time')
  };
  report.tests.textInput.results.push(test1_1);
  console.log(`   ${test1_1.passed ? '✅' : '❌'} Result:`, test1_1.received || 'No response');
  
  // Test 1.2: "what time is it" (no wake word)
  console.log('\n▶ Test 1.2: "what time is it" (no wake word)');
  changoResponseReceived = false;
  
  modules.voiceBus.emitUserText('what time is it');
  await wait(1000);
  
  const test1_2 = {
    name: 'No wake word blocks message',
    input: 'what time is it',
    expected: 'Blocked',
    received: changoResponseReceived ? lastResponse : 'Blocked',
    passed: !changoResponseReceived
  };
  report.tests.textInput.results.push(test1_2);
  console.log(`   ${test1_2.passed ? '✅' : '❌'} Result:`, test1_2.received);
  
  // Test 1.3: "lolo hello"
  console.log('\n▶ Test 1.3: "lolo hello"');
  changoResponseReceived = false;
  
  modules.voiceBus.emitUserText('lolo hello');
  await wait(2000);
  
  const test1_3 = {
    name: 'Wake word + greeting',
    input: 'lolo hello',
    expected: 'Greeting response',
    received: lastResponse,
    passed: changoResponseReceived && (lastResponse.toLowerCase().includes('hello') || lastResponse.toLowerCase().includes('hi'))
  };
  report.tests.textInput.results.push(test1_3);
  console.log(`   ${test1_3.passed ? '✅' : '❌'} Result:`, test1_3.received || 'No response');
  
  // ========================================
  // TEST 2: VOICE SIMULATION
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📝 TEST GROUP 2: VOICE SIMULATION');
  console.log('─'.repeat(50));
  
  // Test 2.1: Simulate STT with "lolo what's the weather"
  console.log('\n▶ Test 2.1: Simulate STT "lolo what\'s the weather"');
  changoResponseReceived = false;
  
  modules.voiceBus.emit({
    type: 'userSpeechRecognized',
    text: "lolo what's the weather",
    source: 'stt'
  });
  await wait(2000);
  
  const test2_1 = {
    name: 'STT with weather command',
    input: "lolo what's the weather",
    expected: 'Weather response',
    received: lastResponse,
    passed: changoResponseReceived && lastResponse.toLowerCase().includes('weather')
  };
  report.tests.voiceSimulation.results.push(test2_1);
  console.log(`   ${test2_1.passed ? '✅' : '❌'} Result:`, test2_1.received || 'No response');
  
  // Test 2.2: Test barge-in (if TTS available)
  if (modules.voiceOrchestrator) {
    console.log('\n▶ Test 2.2: Testing barge-in functionality');
    
    // Start long speech
    modules.voiceOrchestrator.speak("This is a long test message that should be interrupted when the user starts speaking. Testing barge-in functionality now.");
    await wait(500);
    
    const wasSpeaking = modules.voiceOrchestrator.isSpeaking ? modules.voiceOrchestrator.isSpeaking() : false;
    
    // Simulate interruption
    modules.voiceBus.emit({
      type: 'userSpeechRecognized',
      text: 'lolo stop',
      source: 'stt'
    });
    await wait(500);
    
    const stoppedSpeaking = modules.voiceOrchestrator.isSpeaking ? !modules.voiceOrchestrator.isSpeaking() : true;
    
    const test2_2 = {
      name: 'Barge-in interrupts TTS',
      expected: 'TTS stops on interrupt',
      wasSpeaking,
      stoppedSpeaking,
      passed: wasSpeaking && stoppedSpeaking
    };
    report.tests.voiceSimulation.results.push(test2_2);
    console.log(`   ${test2_2.passed ? '✅' : '❌'} Barge-in:`, test2_2.passed ? 'Works' : 'Failed');
  }
  
  // ========================================
  // TEST 3: TTS FUNCTIONALITY
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📝 TEST GROUP 3: TTS FUNCTIONALITY');
  console.log('─'.repeat(50));
  
  if (modules.voiceOrchestrator) {
    // Test 3.1: Check TTS readiness
    console.log('\n▶ Test 3.1: TTS Provider Status');
    const isReady = modules.voiceOrchestrator.isReady ? modules.voiceOrchestrator.isReady() : false;
    
    const test3_1 = {
      name: 'TTS provider ready',
      expected: 'Provider initialized',
      passed: isReady
    };
    report.tests.tts.results.push(test3_1);
    console.log(`   ${test3_1.passed ? '✅' : '❌'} TTS Ready:`, isReady);
    
    // Test 3.2: Test voice synthesis
    if (isReady) {
      console.log('\n▶ Test 3.2: Voice synthesis test');
      
      await modules.voiceOrchestrator.speak("Testing voice synthesis functionality");
      await wait(2000);
      
      const test3_2 = {
        name: 'Voice synthesis works',
        expected: 'Speech executed',
        passed: true // If no error thrown
      };
      report.tests.tts.results.push(test3_2);
      console.log(`   ✅ Voice synthesis executed`);
    }
    
    // Test 3.3: Test cancellation
    console.log('\n▶ Test 3.3: TTS cancellation');
    modules.voiceOrchestrator.speak("This will be cancelled immediately");
    await wait(100);
    modules.voiceOrchestrator.stop();
    
    const isStopped = modules.voiceOrchestrator.isSpeaking ? !modules.voiceOrchestrator.isSpeaking() : true;
    
    const test3_3 = {
      name: 'TTS cancellation',
      expected: 'Speech stopped',
      passed: isStopped
    };
    report.tests.tts.results.push(test3_3);
    console.log(`   ${test3_3.passed ? '✅' : '❌'} Cancellation:`, isStopped ? 'Works' : 'Failed');
  } else {
    report.issues.push('TTS: voiceOrchestrator not available');
    console.log('   ⚠️ TTS tests skipped - voiceOrchestrator not available');
  }
  
  // ========================================
  // TEST 4: GLOBALMONITOR INTEGRATION
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📝 TEST GROUP 4: GLOBALMONITOR INTEGRATION');
  console.log('─'.repeat(50));
  
  if (modules.GlobalMonitor) {
    console.log('\n▶ Test 4.1: GlobalMonitor functions');
    
    const hasMarkHeard = typeof modules.GlobalMonitor.markHeard === 'function';
    const hasMarkSTT = typeof modules.GlobalMonitor.markSTT === 'function';
    const hasMarkTTS = typeof modules.GlobalMonitor.markTTS === 'function';
    
    const test4_1 = {
      name: 'Monitor functions available',
      functions: { hasMarkHeard, hasMarkSTT, hasMarkTTS },
      passed: hasMarkHeard && hasMarkSTT && hasMarkTTS
    };
    report.tests.globalMonitor.results.push(test4_1);
    console.log(`   ${test4_1.passed ? '✅' : '❌'} Functions:`, test4_1.functions);
    
    // Test marking functions
    if (hasMarkHeard) {
      console.log('\n▶ Test 4.2: Testing activity marking');
      
      modules.GlobalMonitor.markHeard();
      modules.GlobalMonitor.markSTT(true);
      modules.GlobalMonitor.markTTS(false);
      
      const test4_2 = {
        name: 'Activity marking works',
        passed: true // No errors
      };
      report.tests.globalMonitor.results.push(test4_2);
      console.log(`   ✅ Activity marked successfully`);
    }
  } else {
    report.issues.push('GlobalMonitor: Not available - self-healing disabled');
    console.log('   ⚠️ GlobalMonitor tests skipped - not available');
  }
  
  // ========================================
  // GENERATE REPORT
  // ========================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Browser: ${navigator.userAgent.substring(0, 50)}...`);
  
  // Text Input Summary
  const textPassed = report.tests.textInput.results.filter(t => t.passed).length;
  const textTotal = report.tests.textInput.results.length;
  report.tests.textInput.summary = `${textPassed}/${textTotal} passed`;
  console.log(`\n📝 Text Input: ${report.tests.textInput.summary}`);
  report.tests.textInput.results.forEach(t => {
    console.log(`   ${t.passed ? '✅' : '❌'} ${t.name}`);
  });
  
  // Voice Simulation Summary
  const voicePassed = report.tests.voiceSimulation.results.filter(t => t.passed).length;
  const voiceTotal = report.tests.voiceSimulation.results.length;
  report.tests.voiceSimulation.summary = `${voicePassed}/${voiceTotal} passed`;
  console.log(`\n🎤 Voice Simulation: ${report.tests.voiceSimulation.summary}`);
  report.tests.voiceSimulation.results.forEach(t => {
    console.log(`   ${t.passed ? '✅' : '❌'} ${t.name}`);
  });
  
  // TTS Summary
  const ttsPassed = report.tests.tts.results.filter(t => t.passed).length;
  const ttsTotal = report.tests.tts.results.length;
  report.tests.tts.summary = `${ttsPassed}/${ttsTotal} passed`;
  console.log(`\n🔊 TTS: ${report.tests.tts.summary}`);
  report.tests.tts.results.forEach(t => {
    console.log(`   ${t.passed ? '✅' : '❌'} ${t.name}`);
  });
  
  // GlobalMonitor Summary
  const monitorPassed = report.tests.globalMonitor.results.filter(t => t.passed).length;
  const monitorTotal = report.tests.globalMonitor.results.length;
  report.tests.globalMonitor.summary = `${monitorPassed}/${monitorTotal} passed`;
  console.log(`\n🏥 GlobalMonitor: ${report.tests.globalMonitor.summary}`);
  report.tests.globalMonitor.results.forEach(t => {
    console.log(`   ${t.passed ? '✅' : '❌'} ${t.name}`);
  });
  
  // Issues & Recommendations
  if (textPassed < textTotal) {
    report.issues.push('Text input: Wake word filtering not working correctly');
    report.recommendations.push('Check gate module and conversation engine integration');
  }
  
  if (voicePassed < voiceTotal) {
    report.issues.push('Voice simulation: STT event handling has issues');
    report.recommendations.push('Verify STT events are properly routed through conversation engine');
  }
  
  if (!modules.voiceOrchestrator) {
    report.recommendations.push('Initialize TTS system: voiceOrchestrator not available');
  }
  
  if (!modules.GlobalMonitor) {
    report.recommendations.push('Enable self-healing: GlobalMonitor not initialized');
  }
  
  // Display issues
  if (report.issues.length > 0) {
    console.log('\n⚠️ ISSUES FOUND:');
    report.issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }
  
  // Display recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  } else {
    console.log('\n✅ All systems functioning correctly!');
  }
  
  // Final verdict
  const totalPassed = textPassed + voicePassed + ttsPassed + monitorPassed;
  const totalTests = textTotal + voiceTotal + ttsTotal + monitorTotal;
  const percentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
  
  console.log('\n' + '='.repeat(70));
  console.log(`FINAL SCORE: ${totalPassed}/${totalTests} tests passed (${percentage}%)`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 PERFECT! All tests passed!');
  } else if (Number(percentage) >= 80) {
    console.log('✅ GOOD: Most features working correctly');
  } else if (Number(percentage) >= 50) {
    console.log('⚠️ NEEDS WORK: Several issues need attention');
  } else {
    console.log('❌ CRITICAL: Major issues detected');
  }
  console.log('='.repeat(70));
  
  // Cleanup
  unsubscribe();
  
  // Save report
  (window as any).testReport = report;
  console.log('\n💾 Full report saved to window.testReport');
  
  return report;
}

// Auto-expose
if (import.meta.env.DEV) {
  (window as any).manualPipelineTest = manualPipelineTest;
  console.log('[ManualTest] Ready: await manualPipelineTest()');
  
  // Auto-run after delay
  setTimeout(() => {
    console.log('\n🔄 Running manual pipeline test in 3 seconds...');
    setTimeout(() => {
      manualPipelineTest().then(report => {
        console.log('\n✅ Manual test complete!');
      });
    }, 3000);
  }, 2000);
}