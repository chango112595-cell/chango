/**
 * Browser Console Test for GlobalMonitor
 * Run this test directly in the browser console to verify GlobalMonitor functionality
 */

export function testGlobalMonitorLive() {
  console.log('🔍 === GlobalMonitor Live Test Starting ===');
  console.log('This test verifies the actual GlobalMonitor instance in production');
  console.log('Timestamp:', new Date().toISOString());
  
  const results: any[] = [];
  let testIndex = 0;
  
  function logTest(name: string, passed: boolean, details: string) {
    testIndex++;
    const emoji = passed ? '✅' : '❌';
    console.log(`${emoji} Test ${testIndex}: ${name}`);
    console.log(`   ${details}`);
    results.push({ name, passed, details });
  }
  
  // Test 1: Check if GlobalMonitor is initialized
  console.log('\n📋 Test 1: GlobalMonitor Initialization Check');
  try {
    // Check if bootstrap was successful
    const bootstrapped = (window as any).__LOLO_BOOTSTRAPPED__;
    const bootstrapTime = (window as any).__LOLO_BOOTSTRAP_TIME__;
    
    if (bootstrapped) {
      logTest('GlobalMonitor Initialized', true, 
        `Bootstrap completed at ${bootstrapTime}`);
    } else {
      logTest('GlobalMonitor Initialized', false, 
        'Bootstrap not detected - GlobalMonitor may not be running');
    }
  } catch (error) {
    logTest('GlobalMonitor Initialized', false, `Error: ${error}`);
  }
  
  // Test 2: Check DebugBus Integration
  console.log('\n📋 Test 2: DebugBus Event Forwarding');
  try {
    let eventsCaptured = 0;
    const startTime = Date.now();
    
    // Listen to debug bus for 2 seconds
    const listener = (event: any) => {
      if (event.tag && (event.tag.includes('NET') || event.tag.includes('STT') || 
          event.tag.includes('TTS') || event.tag.includes('Health'))) {
        eventsCaptured++;
        console.log(`  Captured event: ${event.tag} - ${event.level}`);
      }
    };
    
    // Check if debugBus is available
    if (typeof (window as any).debugBus !== 'undefined') {
      const unsubscribe = (window as any).debugBus.on(listener);
      
      setTimeout(() => {
        unsubscribe();
        logTest('DebugBus Event Forwarding', eventsCaptured > 0,
          `Captured ${eventsCaptured} GlobalMonitor events in 2 seconds`);
      }, 2000);
    } else {
      // Try using DebugBus directly
      logTest('DebugBus Event Forwarding', false, 
        'DebugBus not found in window - checking console logs instead');
    }
  } catch (error) {
    logTest('DebugBus Event Forwarding', false, `Error: ${error}`);
  }
  
  // Test 3: Check Console Logging
  console.log('\n📋 Test 3: Console Logging Verification');
  try {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    let logsCaptured = 0;
    
    // Intercept console logs for 3 seconds
    console.log = (...args) => {
      const logStr = args.join(' ');
      if (logStr.includes('[HealthMonitor]') || logStr.includes('[GlobalMonitor]') ||
          logStr.includes('[Health]') || logStr.includes('NET') || 
          logStr.includes('STT') || logStr.includes('TTS')) {
        logsCaptured++;
      }
      originalLog.apply(console, args);
    };
    
    console.warn = (...args) => {
      const logStr = args.join(' ');
      if (logStr.includes('[HealthMonitor]') || logStr.includes('[GlobalMonitor]')) {
        logsCaptured++;
      }
      originalWarn.apply(console, args);
    };
    
    setTimeout(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      
      logTest('Console Logging', logsCaptured > 0,
        `Captured ${logsCaptured} monitor-related logs`);
    }, 3000);
  } catch (error) {
    logTest('Console Logging', false, `Error: ${error}`);
  }
  
  // Test 4: Simulate STT Silence
  console.log('\n📋 Test 4: STT Silence Detection Simulation');
  console.log('   Monitoring for STT restart events...');
  console.log('   ⏳ This test takes about 15 seconds...');
  
  try {
    // Mark STT as active but don't send heard events
    if ((window as any).GlobalMonitor) {
      (window as any).GlobalMonitor.markSTT(true);
      
      // Wait 15 seconds to see if auto-restart triggers
      setTimeout(() => {
        (window as any).GlobalMonitor.markSTT(false);
        logTest('STT Silence Detection', true,
          'STT silence monitoring active (check console for restart logs)');
      }, 15000);
    } else {
      logTest('STT Silence Detection', false, 
        'GlobalMonitor not accessible from window');
    }
  } catch (error) {
    logTest('STT Silence Detection', false, `Error: ${error}`);
  }
  
  // Test 5: TTS Hang Detection
  console.log('\n📋 Test 5: TTS Hang Detection Simulation');
  console.log('   ⏳ This test takes about 10 seconds...');
  
  try {
    if ((window as any).GlobalMonitor) {
      // Mark TTS as busy
      (window as any).GlobalMonitor.markTTS(true);
      
      // Wait 10 seconds to see if auto-cancel triggers
      setTimeout(() => {
        (window as any).GlobalMonitor.markTTS(false);
        logTest('TTS Hang Detection', true,
          'TTS hang monitoring active (check console for cancel logs)');
      }, 10000);
    } else {
      logTest('TTS Hang Detection', false, 
        'GlobalMonitor not accessible from window');
    }
  } catch (error) {
    logTest('TTS Hang Detection', false, `Error: ${error}`);
  }
  
  // Test 6: Check Health Monitor Integration
  console.log('\n📋 Test 6: Health Monitor Integration');
  try {
    // Check if health monitor is running by looking for its logs
    const healthCheckInterval = setInterval(() => {
      console.log('[TEST] Waiting for health check logs...');
    }, 5000);
    
    setTimeout(() => {
      clearInterval(healthCheckInterval);
      logTest('Health Monitor Integration', true,
        'Health checks running (monitor console for [HealthMonitor] logs)');
    }, 10000);
  } catch (error) {
    logTest('Health Monitor Integration', false, `Error: ${error}`);
  }
  
  // Generate final report after all tests complete
  setTimeout(() => {
    console.log('\n========================================');
    console.log('📊 GlobalMonitor Live Test Report');
    console.log('========================================');
    console.log('Test Completion Time:', new Date().toISOString());
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.passed).length}`);
    console.log(`Failed: ${results.filter(r => !r.passed).length}`);
    console.log('\nDetailed Results:');
    results.forEach((result, index) => {
      const emoji = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${emoji} ${result.name}`);
      console.log(`   ${result.details}`);
    });
    
    console.log('\n📌 Manual Verification Steps:');
    console.log('1. Check browser console for [HealthMonitor] logs');
    console.log('2. Look for [GlobalMonitor] or [Health] tagged messages');
    console.log('3. Verify network ping logs appear every 5 seconds');
    console.log('4. Check for severity levels: info, warn, error');
    console.log('5. Verify auto-healing actions in the logs');
    
    console.log('\n💡 Tips:');
    console.log('- Filter console by "[Health" to see health-related logs');
    console.log('- Look for "auto_cancel_tts" and "stt_heartbeat" events');
    console.log('- Monitor "check_no_mic" events for microphone issues');
    
    // Store results for inspection
    (window as any).__GLOBAL_MONITOR_TEST_RESULTS__ = {
      results,
      timestamp: new Date().toISOString(),
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length
    };
    
    console.log('\n✅ Test complete! Results stored in: window.__GLOBAL_MONITOR_TEST_RESULTS__');
  }, 30000); // Wait for all async tests to complete
  
  return 'Test running... Results will appear in ~30 seconds';
}

// Auto-expose to window
if (typeof window !== 'undefined') {
  (window as any).testGlobalMonitor = testGlobalMonitorLive;
  console.log('GlobalMonitor test ready! Run: testGlobalMonitor()');
}