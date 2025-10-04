/**
 * Test that typed messages work even when the Gate is closed
 */

import { voiceGate } from '../src/core/gate';
import { orchestrator } from '../src/core/orchestrator';
import { responder } from '../src/services/responder';
import { debugBus } from '../src/dev/debugBus';

async function testTextBypassesGate() {
  console.log('=== Testing Text Messages Bypass Gate ===');
  
  // Test 1: Close the gate
  voiceGate.close('test');
  const gateStatusClosed = voiceGate.getStatus();
  console.log('Gate status after closing:', gateStatusClosed);
  
  if (gateStatusClosed.isOpen) {
    console.error('❌ Gate should be closed but is open!');
    return false;
  }
  
  // Test 2: Text should still pass through
  const textDecision = await orchestrator.routeMessage({
    text: 'This is a text message',
    source: 'text'
  });
  
  console.log('Text routing decision:', textDecision);
  
  if (!textDecision.shouldProcess || textDecision.responseType !== 'text') {
    console.error('❌ Text message was blocked by closed gate!');
    return false;
  }
  
  console.log('✅ Text message correctly bypassed closed gate');
  
  // Test 3: Voice should be blocked
  const voiceDecision = await orchestrator.routeMessage({
    text: 'This is a voice message',
    source: 'voice'
  });
  
  console.log('Voice routing decision:', voiceDecision);
  
  if (voiceDecision.shouldProcess) {
    console.error('❌ Voice message was allowed through closed gate!');
    return false;
  }
  
  console.log('✅ Voice message correctly blocked by closed gate');
  
  // Test 4: Test responder with text when gate is closed
  const response = await responder.respond('What time is it?', {
    source: 'text',
    responseType: 'text'
  });
  
  console.log('Responder response:', response);
  
  if (!response || response.length === 0) {
    console.error('❌ Responder failed to respond to text when gate was closed!');
    return false;
  }
  
  console.log('✅ Responder correctly handled text message with closed gate');
  
  // Test 5: Open gate and verify voice works
  await voiceGate.open('test');
  const gateStatusOpen = voiceGate.getStatus();
  console.log('Gate status after opening:', gateStatusOpen);
  
  if (!gateStatusOpen.canPassVoice) {
    console.error('❌ Voice cannot pass through open gate!');
    return false;
  }
  
  const voiceDecisionOpen = await orchestrator.routeMessage({
    text: 'This is a voice message with open gate',
    source: 'voice'
  });
  
  if (!voiceDecisionOpen.shouldProcess) {
    console.error('❌ Voice message was blocked with open gate!');
    return false;
  }
  
  console.log('✅ Voice message correctly allowed through open gate');
  
  console.log('\n=== All Gate Bypass Tests Passed! ===');
  console.log('Summary:');
  console.log('  ✓ Text messages always pass through');
  console.log('  ✓ Voice messages respect gate state');
  console.log('  ✓ Responder works with text regardless of gate');
  console.log('  ✓ Gate state correctly controls voice routing');
  
  return true;
}

// Export for use in test runners
export { testTextBypassesGate };

// Run test if executed directly
if (typeof window === 'undefined' && require.main === module) {
  testTextBypassesGate()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed with error:', error);
      process.exit(1);
    });
}