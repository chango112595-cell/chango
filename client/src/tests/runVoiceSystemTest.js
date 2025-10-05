/**
 * Direct Browser Console Test for Voice System
 * Run this directly in the browser console to test all voice components
 */

(function testVoiceSystem() {
  console.log('\n');
  console.log('🚀 VOICE SYSTEM TEST - RUNNING NOW');
  console.log('=' .repeat(60));
  console.log('Time:', new Date().toISOString());
  console.log('=' .repeat(60));
  
  const results = {
    passed: [],
    failed: [],
    issues: []
  };
  
  function test(name, condition, details) {
    if (condition) {
      console.log(`✅ ${name}: PASSED`);
      if (details) console.log(`   └─ ${details}`);
      results.passed.push(name);
    } else {
      console.error(`❌ ${name}: FAILED`);
      if (details) console.log(`   └─ ${details}`);
      results.failed.push(name);
      results.issues.push(`${name}: ${details || 'Test failed'}`);
    }
  }
  
  console.log('\n📋 1. CHECKING INITIALIZATION');
  console.log('─'.repeat(40));
  
  // Check bootstrap
  test('Bootstrap Complete', 
    window.CHANGO_BOOTSTRAP_COMPLETE === true,
    `Bootstrap flag: ${window.CHANGO_BOOTSTRAP_COMPLETE}`
  );
  
  // Check modules
  test('VoiceBus Available', 
    !!window.voiceBus,
    window.voiceBus ? 'VoiceBus module loaded' : 'VoiceBus not found'
  );
  
  test('ConversationEngine Available',
    !!window.conversationEngine,
    window.conversationEngine ? 'Engine exposed' : 'Engine not found'
  );
  
  test('VoiceOrchestrator Available',
    !!window.voiceOrchestrator,
    window.voiceOrchestrator ? 'Orchestrator ready' : 'Orchestrator not found'
  );
  
  test('GlobalMonitor Available',
    !!window.GlobalMonitor,
    window.GlobalMonitor ? 'Monitor active' : 'Monitor not found'
  );
  
  test('DebugBus Available',
    !!window.debugBus,
    window.debugBus ? 'Debug logging ready' : 'Debug bus not found'
  );
  
  console.log('\n📋 2. CHECKING PERMISSIONS & MIC');
  console.log('─'.repeat(40));
  
  // Check mic permission from session storage
  const micDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
  const micNotFound = sessionStorage.getItem('mic_device_not_found') === 'true';
  
  test('Mic Permission',
    !micDenied,
    micDenied ? 'Permission DENIED - grant in browser settings' : 'Permission available'
  );
  
  test('Mic Device',
    !micNotFound,
    micNotFound ? 'No microphone device found' : 'Microphone device available'
  );
  
  // Check ensureMicReady
  test('ensureMicReady Function',
    typeof window.ensureMicReady === 'function',
    window.ensureMicReady ? 'Helper function exposed' : 'Function not available'
  );
  
  console.log('\n📋 3. CHECKING WAKE WORD CONFIGURATION');
  console.log('─'.repeat(40));
  
  // Test wake word gate
  if (window.listeningGate) {
    const tests = [
      { input: 'what time is it', expected: false },
      { input: 'lolo what time is it', expected: true },
      { input: 'hey lolo what time', expected: false },
      { input: 'lolo', expected: true }
    ];
    
    tests.forEach(t => {
      const result = window.listeningGate.passGate(t.input, true);
      test(`Wake word: "${t.input}"`,
        result.allowed === t.expected,
        `${result.allowed ? 'Allowed' : 'Blocked'} (${result.reason})`
      );
    });
  } else {
    test('Wake Word Gate', false, 'ListeningGate not available');
  }
  
  console.log('\n📋 4. CHECKING DUPLICATE SUPPRESSION');
  console.log('─'.repeat(40));
  
  // Check if duplicate guard is available
  test('DuplexGuard Available',
    !!window.DuplexGuard,
    window.DuplexGuard ? 'Echo prevention ready' : 'DuplexGuard not found'
  );
  
  // Check duplicate suppression function
  test('isDuplicate Function',
    typeof window.isDuplicate === 'function',
    window.isDuplicate ? 'Duplicate check available' : 'Function not found'
  );
  
  console.log('\n📋 5. CHECKING DEBUG MONITORING');
  console.log('─'.repeat(40));
  
  // Test debug monitoring by emitting events
  if (window.debugBus) {
    let capturedEvents = 0;
    const originalLog = console.log;
    console.log = function(...args) {
      if (args[0]?.includes?.('TEST_DEBUG')) capturedEvents++;
      originalLog.apply(console, args);
    };
    
    window.debugBus.info('TEST_DEBUG', 'Test info message');
    window.debugBus.warn('TEST_DEBUG', 'Test warning');
    window.debugBus.error('TEST_DEBUG', 'Test error');
    
    console.log = originalLog;
    
    test('Debug Event Logging',
      capturedEvents > 0,
      `Captured ${capturedEvents} debug events`
    );
  }
  
  console.log('\n📋 6. CHECKING STT/TTS/GATE STATUS');
  console.log('─'.repeat(40));
  
  // Check STT status
  test('STT Manager',
    !!window.alwaysListenManager,
    window.alwaysListenManager ? 'STT manager available' : 'Manager not found'
  );
  
  // Check TTS
  test('TTS Speak Function',
    !!(window.voiceOrchestrator?.speak),
    window.voiceOrchestrator?.speak ? 'TTS ready' : 'TTS not initialized'
  );
  
  // Check Voice Gate
  test('Voice Gate',
    !!window.voiceGate,
    window.voiceGate ? 'Gate system ready' : 'Gate not found'
  );
  
  console.log('\n📋 7. TESTING USER INTERACTION TRIGGERS');
  console.log('─'.repeat(40));
  
  // Test chat input focus trigger
  const chatInput = document.querySelector('input[type="text"], textarea');
  if (chatInput) {
    let micReadyCalled = false;
    
    if (window.ensureMicReady) {
      const original = window.ensureMicReady;
      window.ensureMicReady = async function() {
        micReadyCalled = true;
        return original.apply(this, arguments);
      };
      
      // Simulate focus event
      chatInput.dispatchEvent(new FocusEvent('focus'));
      
      // Check if it was called
      setTimeout(() => {
        test('ensureMicReady on Focus',
          micReadyCalled,
          micReadyCalled ? 'Triggered on input focus' : 'Not triggered'
        );
        window.ensureMicReady = original;
      }, 100);
    }
  } else {
    test('Chat Input Element', false, 'No input element found');
  }
  
  // Final summary
  setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length} tests`);
    console.log(`❌ Failed: ${results.failed.length} tests`);
    
    if (results.failed.length > 0) {
      console.log('\n⚠️  FAILED TESTS:');
      results.failed.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }
    
    if (results.issues.length > 0) {
      console.log('\n🔧 ISSUES TO FIX:');
      results.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }
    
    // Recommendations based on failures
    console.log('\n💡 RECOMMENDATIONS:');
    if (micDenied) {
      console.log('  • Grant microphone permission in browser settings');
    }
    if (micNotFound) {
      console.log('  • Check that a microphone is connected and enabled');
    }
    if (!window.voiceBus || !window.conversationEngine) {
      console.log('  • Voice system not fully initialized - check bootstrap');
    }
    if (!window.ensureMicReady) {
      console.log('  • ensureMicReady helper not exposed - check imports');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ VOICE SYSTEM TEST COMPLETE');
    console.log('='.repeat(60));
    
    // Save results
    window.lastVoiceTestResults = results;
    console.log('💾 Results saved to: window.lastVoiceTestResults');
  }, 500);
})();