/**
 * Automated diagnostic that runs on page load to identify the issue
 */

import { voiceBus } from './voice/voiceBus';

export function runAutoDiagnostic() {
  console.log('');
  console.log('🔍 === AUTOMATED DIAGNOSTIC STARTING ===');
  console.log('Testing the complete message flow chain...');
  console.log('');
  
  // Check 1: VoiceBus is available
  console.log('✓ Check 1: VoiceBus available:', !!voiceBus);
  
  // Check 2: Check registered listeners
  const listeners = (voiceBus as any).listeners;
  console.log('✓ Check 2: Registered event types:', listeners?.size || 0);
  
  // List all registered event types and their listener counts
  if (listeners) {
    console.log('Event listeners registered:');
    let hasUserTextSubmittedListener = false;
    listeners.forEach((value: any, key: any) => {
      console.log(`  - "${key}": ${value.size} listener(s)`);
      if (key === 'userTextSubmitted') {
        hasUserTextSubmittedListener = true;
      }
    });
    
    // Check 3: Verify conversation engine listener
    if (!hasUserTextSubmittedListener) {
      console.error('❌ PROBLEM FOUND: No listener registered for "userTextSubmitted" events!');
      console.error('   The conversation engine is not listening for typed messages.');
      console.error('   This is why typed messages are not getting responses.');
    } else {
      console.log('✓ Check 3: userTextSubmitted has listeners');
    }
  }
  
  // Check 4: Test the actual flow
  console.log('');
  console.log('📧 Check 4: Testing message flow with "What time is it?"...');
  
  let eventReceived = false;
  let responseReceived = false;
  
  // Set up temporary listeners
  const unsubscribe1 = voiceBus.on('userTextSubmitted', (event) => {
    eventReceived = true;
    console.log('  ✓ userTextSubmitted event received:', event.text);
  });
  
  const unsubscribe2 = voiceBus.on('changoResponse', (event) => {
    responseReceived = true;
    console.log('  ✓ changoResponse event received:', event.text);
  });
  
  // Send test message
  voiceBus.emitUserText("What time is it?");
  
  // Check results after a delay
  setTimeout(() => {
    console.log('');
    console.log('📊 DIAGNOSTIC RESULTS:');
    
    if (!eventReceived) {
      console.error('❌ CRITICAL: userTextSubmitted event was NOT received');
      console.error('   Problem is in voiceBus.emitUserText() or event emission');
    } else if (!responseReceived) {
      console.error('❌ CRITICAL: changoResponse was NOT received');
      console.error('   Problem is in conversation engine processing or response generation');
      console.error('   Check if conversation engine is initialized and listening');
    } else {
      console.log('✅ SUCCESS: Complete message flow is working!');
    }
    
    // Clean up
    unsubscribe1();
    unsubscribe2();
    
    console.log('');
    console.log('🔍 === DIAGNOSTIC COMPLETE ===');
    console.log('');
    
    // Log the actual conversation engine status
    const conversationEngine = (window as any).conversationEngine;
    if (conversationEngine) {
      console.log('Conversation Engine is exposed to window ✓');
      console.log('Available functions:', Object.keys(conversationEngine));
    } else {
      console.error('Conversation Engine is NOT exposed to window ✗');
    }
  }, 1000);
}

// Run diagnostic automatically after a short delay to ensure everything is initialized
if (import.meta.env.DEV) {
  setTimeout(() => {
    runAutoDiagnostic();
  }, 2000);
  
  // Also expose for manual running
  (window as any).runDiagnostic = runAutoDiagnostic;
  console.log('[Diagnostic] Auto-diagnostic will run in 2 seconds...');
  console.log('[Diagnostic] You can also run manually with runDiagnostic()');
}