/**
 * Test to verify health monitor properly handles mic unavailable scenarios
 */

export function testMicUnavailableHandling() {
  console.log('=== Testing Mic Unavailable Handling ===');
  
  // Simulate mic not found scenario
  sessionStorage.setItem('mic_device_not_found', 'true');
  
  console.log('✓ Set mic_device_not_found flag');
  
  // Check that health monitor is not spamming errors
  const checkInterval = setInterval(() => {
    const logs = (window as any).__CH_DEBUG__?.getEvents?.() || [];
    const recentErrors = logs.filter((log: any) => 
      log.type === 'error' && 
      log.timestamp > Date.now() - 5000 &&
      (log.message?.includes('mic') || log.message?.includes('STT'))
    );
    
    if (recentErrors.length > 0) {
      console.error('❌ Found mic-related errors in last 5 seconds:', recentErrors);
    } else {
      console.log('✅ No mic-related errors in last 5 seconds');
    }
  }, 5000);
  
  // Test that text chat still works
  const voiceBus = (window as any).voiceBus;
  if (voiceBus) {
    console.log('✓ Testing text message flow with mic unavailable...');
    voiceBus.emitUserText('Test message with mic unavailable');
    console.log('✓ Text message sent successfully');
  }
  
  // Clean up after 15 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    // Remove the test flags
    sessionStorage.removeItem('mic_device_not_found');
    sessionStorage.removeItem('mic_permission_denied');
    console.log('=== Test Complete - Flags Cleared ===');
  }, 15000);
}

// Expose to window for manual testing
if (typeof window !== 'undefined') {
  (window as any).testMicUnavailable = testMicUnavailableHandling;
  console.log('[Test] Mic unavailable test ready. Run with: testMicUnavailable()');
}