/**
 * Test script for DebugOverlay functionality
 * Run this in the browser console to verify the DebugOverlay is working
 */

// This file is imported by main.tsx to run tests automatically
export function testDebugOverlay() {
  // Check if voiceBus is exposed to window
  if (typeof window !== 'undefined' && (window as any).voiceBus) {
    console.log('✅ voiceBus is exposed to window');
    
    const voiceBus = (window as any).voiceBus;
    
    // Test different event types
    console.log('🧪 Testing DebugOverlay with various events...');
    
    // Test 1: Speak event
    voiceBus.emitSpeak('Testing DebugOverlay speak event - This is a long message that should be truncated after 80 characters in the overlay display');
    
    // Test 2: User text submitted
    setTimeout(() => {
      voiceBus.emitUserText('What time is it?');
    }, 500);
    
    // Test 3: Chango response
    setTimeout(() => {
      voiceBus.emit({
        type: 'changoResponse',
        text: 'The current time is 5:03 AM. This is a test response from Chango to verify the DebugOverlay displays responses correctly.',
        source: 'system'
      });
    }, 1000);
    
    // Test 4: State changes
    setTimeout(() => {
      voiceBus.setMute(true);
    }, 1500);
    
    setTimeout(() => {
      voiceBus.setMute(false);
    }, 2000);
    
    setTimeout(() => {
      voiceBus.setPower(false);
    }, 2500);
    
    setTimeout(() => {
      voiceBus.setPower(true);
    }, 3000);
    
    // Test 5: Speaking state change
    setTimeout(() => {
      voiceBus.setSpeaking(true);
    }, 3500);
    
    setTimeout(() => {
      voiceBus.setSpeaking(false);
    }, 4000);
    
    console.log('✅ Test events emitted - check the DebugOverlay at bottom-left corner');
    console.log('📝 You can also test manually in console:');
    console.log('  window.voiceBus.emitSpeak("Hello from console!")');
    console.log('  window.voiceBus.emitUserText("Test question?")');
    console.log('  window.voiceBus.setMute(true/false)');
    console.log('  window.voiceBus.setPower(true/false)');
    
  } else {
    console.log('⚠️ voiceBus not yet exposed to window - DebugOverlay may not be loaded');
  }
}

// Auto-run test after a short delay to ensure everything is loaded
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testDebugOverlay();
  }, 2000);
}