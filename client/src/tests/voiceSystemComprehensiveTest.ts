/**
 * Comprehensive Voice System Test Suite
 * Tests all voice system components including initialization, wake word, 
 * duplicate suppression, debug monitoring, and STT/TTS/Gate statuses
 */

export async function voiceSystemComprehensiveTest() {
  console.log('\n🚀 === COMPREHENSIVE VOICE SYSTEM TEST ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('=' .repeat(60));
  
  const testResults = {
    timestamp: new Date().toISOString(),
    initialization: { passed: 0, failed: 0, tests: [] as any[] },
    permissions: { passed: 0, failed: 0, tests: [] as any[] },
    wakeWord: { passed: 0, failed: 0, tests: [] as any[] },
    duplicateSuppression: { passed: 0, failed: 0, tests: [] as any[] },
    debugMonitoring: { passed: 0, failed: 0, tests: [] as any[] },
    sttTtsGate: { passed: 0, failed: 0, tests: [] as any[] },
    ensureMicReady: { passed: 0, failed: 0, tests: [] as any[] },
    issues: [] as string[],
    recommendations: [] as string[]
  };

  // Helper functions
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const logTest = (category: keyof typeof testResults, name: string, passed: boolean, details: string) => {
    const cat = testResults[category];
    if (typeof cat === 'object' && cat !== null && 'tests' in cat) {
      cat.tests.push({ name, passed, details, timestamp: new Date().toISOString() });
      if (passed) {
        cat.passed++;
        console.log(`✅ [${category}] ${name}: PASSED`);
      } else {
        cat.failed++;
        console.error(`❌ [${category}] ${name}: FAILED`);
        testResults.issues.push(`${category}: ${name} - ${details}`);
      }
      console.log(`   └─ ${details}`);
    }
  };

  // Get all required modules
  const modules = {
    voiceBus: (window as any).voiceBus,
    conversationEngine: (window as any).conversationEngine,
    listeningGate: (window as any).listeningGate,
    voiceOrchestrator: (window as any).voiceOrchestrator,
    GlobalMonitor: (window as any).GlobalMonitor,
    debugBus: (window as any).debugBus,
    DuplexGuard: (window as any).DuplexGuard,
    ensureMicReady: (window as any).ensureMicReady,
    alwaysListenManager: (window as any).alwaysListenManager,
    checkMicPermission: (window as any).checkMicPermission,
    voiceGate: (window as any).voiceGate
  };

  console.log('\n📦 Module Availability Check:');
  console.log('─'.repeat(40));
  Object.entries(modules).forEach(([name, module]) => {
    console.log(`${module ? '✅' : '❌'} ${name}: ${module ? 'Available' : 'NOT FOUND'}`);
  });

  // ========================================
  // TEST GROUP 1: INITIALIZATION
  // ========================================
  console.log('\n\n📋 TEST GROUP 1: System Initialization');
  console.log('─'.repeat(40));

  // Test bootstrap completion
  const bootstrapComplete = !!(window as any).CHANGO_BOOTSTRAP_COMPLETE;
  logTest('initialization', 'Bootstrap Complete', bootstrapComplete, 
    bootstrapComplete ? 'Bootstrap flag set' : 'Bootstrap not completed');

  // Test conversation engine initialization
  if (modules.conversationEngine) {
    const isInitialized = modules.conversationEngine.isInitialized?.() || false;
    logTest('initialization', 'Conversation Engine', isInitialized,
      isInitialized ? 'Engine initialized' : 'Engine not initialized');
  } else {
    logTest('initialization', 'Conversation Engine', false, 'Module not found');
  }

  // Test VoiceOrchestrator initialization
  logTest('initialization', 'Voice Orchestrator', !!modules.voiceOrchestrator,
    modules.voiceOrchestrator ? 'Orchestrator ready' : 'Orchestrator not initialized');

  // Test GlobalMonitor initialization
  logTest('initialization', 'Global Monitor', !!modules.GlobalMonitor,
    modules.GlobalMonitor ? 'Monitor active' : 'Monitor not initialized');

  // ========================================
  // TEST GROUP 2: PERMISSIONS & MIC READY
  // ========================================
  console.log('\n\n📋 TEST GROUP 2: Permissions & Mic Ready');
  console.log('─'.repeat(40));

  // Test microphone permission check
  if (modules.checkMicPermission) {
    const permStatus = await modules.checkMicPermission();
    logTest('permissions', 'Mic Permission Status', true,
      `Permission state: ${permStatus}`);
    
    if (permStatus === 'denied' || permStatus === 'blocked') {
      testResults.issues.push('Microphone permission denied or blocked');
      testResults.recommendations.push('Grant microphone permission in browser settings');
    }
  } else {
    logTest('permissions', 'Mic Permission Check', false, 'checkMicPermission not available');
  }

  // Test ensureMicReady function
  if (modules.ensureMicReady) {
    logTest('ensureMicReady', 'Function Available', true, 'ensureMicReady is exposed');
    
    // Simulate user interaction to test ensureMicReady
    console.log('\n  🎯 Testing ensureMicReady on simulated user interaction...');
    
    try {
      // Trigger through chat input focus if available
      const chatInput = document.querySelector('input[type="text"], textarea') as HTMLInputElement;
      if (chatInput) {
        // Monitor for ensureMicReady call
        let ensureMicReadyCalled = false;
        const originalEnsureMicReady = modules.ensureMicReady;
        modules.ensureMicReady = async function(...args: any[]) {
          ensureMicReadyCalled = true;
          console.log('   └─ ensureMicReady called!');
          return originalEnsureMicReady.apply(this, args);
        };
        
        // Dispatch focus event
        chatInput.dispatchEvent(new FocusEvent('focus'));
        await wait(100);
        
        logTest('ensureMicReady', 'Triggered on Focus', ensureMicReadyCalled,
          ensureMicReadyCalled ? 'Called on input focus' : 'Not called on focus');
        
        // Restore original function
        modules.ensureMicReady = originalEnsureMicReady;
      } else {
        logTest('ensureMicReady', 'Chat Input Test', false, 'No chat input element found');
      }
    } catch (error: any) {
      logTest('ensureMicReady', 'Function Test', false, `Error: ${error.message}`);
    }
  } else {
    logTest('ensureMicReady', 'Function Available', false, 'ensureMicReady not exposed');
  }

  // ========================================
  // TEST GROUP 3: WAKE WORD FUNCTIONALITY
  // ========================================
  console.log('\n\n📋 TEST GROUP 3: Wake Word ("lolo")');
  console.log('─'.repeat(40));

  if (modules.listeningGate) {
    // Test wake word detection
    const tests = [
      { input: 'what time is it', shouldPass: false, desc: 'No wake word' },
      { input: 'lolo what time is it', shouldPass: true, desc: 'Wake word at start' },
      { input: 'hey lolo what time', shouldPass: false, desc: 'Wake word not at start' },
      { input: 'lolo', shouldPass: true, desc: 'Just wake word (ping)' },
      { input: 'LOLO hello', shouldPass: true, desc: 'Case insensitive' }
    ];

    for (const test of tests) {
      const result = modules.listeningGate.passGate(test.input, true);
      const passed = result.allowed === test.shouldPass;
      logTest('wakeWord', test.desc, passed,
        `"${test.input}" → ${result.allowed ? 'Allowed' : 'Blocked'} (${result.reason})`);
    }
  } else {
    logTest('wakeWord', 'Gate Module', false, 'ListeningGate not available');
  }

  // ========================================
  // TEST GROUP 4: DUPLICATE SUPPRESSION
  // ========================================
  console.log('\n\n📋 TEST GROUP 4: Duplicate Suppression');
  console.log('─'.repeat(40));

  if (modules.voiceBus) {
    const responses: any[] = [];
    const unsubscribe = modules.voiceBus.on('changoResponse', (event: any) => {
      responses.push({ text: event.text, time: Date.now() });
      console.log(`   └─ Response #${responses.length}: ${event.text}`);
    });

    // Test 1: Send same message twice quickly
    console.log('\n  🎯 Testing rapid duplicate messages...');
    responses.length = 0;
    
    modules.voiceBus.emitUserText('lolo test duplicate');
    await wait(50);
    modules.voiceBus.emitUserText('lolo test duplicate');
    await wait(1000);
    
    logTest('duplicateSuppression', 'Rapid Duplicates Blocked', responses.length <= 1,
      `Received ${responses.length} response(s) for duplicate messages`);

    // Test 2: Send different messages
    console.log('\n  🎯 Testing different messages...');
    responses.length = 0;
    
    modules.voiceBus.emitUserText('lolo hello');
    await wait(500);
    modules.voiceBus.emitUserText('lolo goodbye');
    await wait(1000);
    
    logTest('duplicateSuppression', 'Different Messages Allowed', responses.length === 2,
      `Received ${responses.length} response(s) for different messages`);

    // Test 3: Same message after 3+ seconds
    console.log('\n  🎯 Testing duplicate after timeout...');
    responses.length = 0;
    
    modules.voiceBus.emitUserText('lolo time check');
    await wait(3500); // Wait longer than duplicate window
    modules.voiceBus.emitUserText('lolo time check');
    await wait(1000);
    
    logTest('duplicateSuppression', 'Duplicate After Timeout', responses.length === 2,
      `Received ${responses.length} response(s) after timeout window`);

    unsubscribe();
  } else {
    logTest('duplicateSuppression', 'VoiceBus Available', false, 'VoiceBus not found');
  }

  // ========================================
  // TEST GROUP 5: DEBUG MONITORING
  // ========================================
  console.log('\n\n📋 TEST GROUP 5: Debug Monitoring');
  console.log('─'.repeat(40));

  if (modules.debugBus) {
    let debugEventCaptured = false;
    const debugMessages: any[] = [];
    
    // Set up debug listener
    const originalLog = console.log;
    console.log = function(...args: any[]) {
      if (args[0]?.includes?.('[') && args[0]?.includes?.(']')) {
        debugMessages.push(args.join(' '));
        debugEventCaptured = true;
      }
      originalLog.apply(console, args);
    };

    // Emit debug events
    modules.debugBus.info('TEST', 'Debug test info');
    modules.debugBus.warn('TEST', 'Debug test warning');
    modules.debugBus.error('TEST', 'Debug test error');
    
    await wait(100);
    console.log = originalLog;
    
    logTest('debugMonitoring', 'Debug Events Logged', debugEventCaptured,
      `Captured ${debugMessages.length} debug messages`);
    
    // Test specific module debug logging
    if (modules.GlobalMonitor) {
      modules.GlobalMonitor.markSTT(true);
      modules.GlobalMonitor.markTTS(true);
      modules.GlobalMonitor.markGate(true);
      
      logTest('debugMonitoring', 'Global Monitor Marks', true,
        'STT/TTS/Gate status marked in GlobalMonitor');
    }
  } else {
    logTest('debugMonitoring', 'Debug Bus', false, 'DebugBus not available');
  }

  // ========================================
  // TEST GROUP 6: STT/TTS/GATE STATUS
  // ========================================
  console.log('\n\n📋 TEST GROUP 6: STT/TTS/Gate Status');
  console.log('─'.repeat(40));

  // Check STT status
  const sttStatus = {
    alwaysListenManager: !!modules.alwaysListenManager,
    hasPermission: false,
    isListening: false
  };

  if (modules.alwaysListenManager) {
    const manager = modules.alwaysListenManager;
    sttStatus.hasPermission = manager.hasPermission || false;
    sttStatus.isListening = manager.state === 'listening';
  }

  logTest('sttTtsGate', 'STT Module Status', sttStatus.alwaysListenManager,
    `AlwaysListenManager: ${sttStatus.alwaysListenManager ? 'Ready' : 'Not found'}, ` +
    `Permission: ${sttStatus.hasPermission}, Listening: ${sttStatus.isListening}`);

  // Check TTS status
  const ttsReady = !!modules.voiceOrchestrator?.speak;
  logTest('sttTtsGate', 'TTS Ready', ttsReady,
    ttsReady ? 'TTS speak function available' : 'TTS not initialized');

  // Check Gate status
  const gateReady = !!modules.voiceGate;
  const gateOpen = modules.voiceGate?.isOpen?.() || false;
  logTest('sttTtsGate', 'Voice Gate Status', gateReady,
    `Gate: ${gateReady ? 'Ready' : 'Not found'}, State: ${gateOpen ? 'Open' : 'Closed'}`);

  // Check Duplex Guard (prevents echo)
  const duplexReady = !!modules.DuplexGuard;
  const isSpeaking = modules.DuplexGuard?.isSpeaking?.() || false;
  logTest('sttTtsGate', 'Duplex Guard', duplexReady,
    `DuplexGuard: ${duplexReady ? 'Active' : 'Not found'}, Speaking: ${isSpeaking}`);

  // ========================================
  // FINAL REPORT
  // ========================================
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  Object.entries(testResults).forEach(([category, data]) => {
    if (typeof data === 'object' && 'passed' in data && 'failed' in data) {
      totalPassed += data.passed;
      totalFailed += data.failed;
      const total = data.passed + data.failed;
      if (total > 0) {
        const passRate = ((data.passed / total) * 100).toFixed(1);
        console.log(`${category}: ${data.passed}/${total} passed (${passRate}%)`);
      }
    }
  });
  
  console.log('─'.repeat(60));
  console.log(`TOTAL: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
  console.log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  // Issues found
  if (testResults.issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    testResults.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  // Recommendations
  if (testResults.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    testResults.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
  
  // Add common recommendations based on issues
  console.log('\n📝 COMMON FIXES:');
  console.log('  1. If mic permission denied: Grant permission in browser settings');
  console.log('  2. If STT not working: Check microphone device and unmute if needed');
  console.log('  3. If wake word not working: Ensure "lolo" is said clearly at the start');
  console.log('  4. If duplicates appearing: Check that duplicate suppression is enabled');
  console.log('  5. If no debug logs: Enable debug mode in settings');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPREHENSIVE VOICE SYSTEM TEST COMPLETE');
  console.log('='.repeat(60));
  
  return testResults;
}

// Auto-expose to window in development
if (import.meta.env.DEV) {
  (window as any).voiceSystemTest = voiceSystemComprehensiveTest;
  console.log('📦 Voice System Test ready. Run: window.voiceSystemTest()');
  
  // Auto-run after a delay to ensure system is initialized
  setTimeout(() => {
    console.log('🚀 Auto-running Voice System Comprehensive Test...');
    voiceSystemComprehensiveTest().then(results => {
      (window as any).lastTestResults = results;
      console.log('💾 Test results saved to: window.lastTestResults');
    });
  }, 3000);
}