/**
 * Final Test Script for Wake Word Flow
 * Run in browser console: await finalTest()
 */

export async function finalTest() {
  console.log('\n🚀 === FINAL WAKE WORD TEST ===\n');
  
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  
  if (!voiceBus || !conversationEngine) {
    console.error('❌ Required modules not available');
    return;
  }
  
  console.log('✅ Required modules loaded');
  
  // Set up response listener
  let responseReceived = false;
  let responseText = '';
  
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    responseReceived = true;
    responseText = event.text;
    console.log('🎉 changoResponse received:', event.text);
  });
  
  // Test the complete flow with wake word
  console.log('\n📝 Testing: "lolo what time is it"');
  console.log('   This should pass the gate and generate a response\n');
  
  responseReceived = false;
  voiceBus.emitUserText('lolo what time is it');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (responseReceived) {
    console.log('\n✅ SUCCESS! Response was generated and received:');
    console.log('   Response:', responseText);
    console.log('\n🎉 The wake word flow is working correctly!');
  } else {
    console.error('\n❌ FAILURE! No response received.');
    console.error('   Check the console logs above for details.');
    console.error('   The conversation engine may not be calling respond()');
  }
  
  // Test without wake word (should be blocked)
  console.log('\n📝 Testing: "what time is it" (no wake word)');
  responseReceived = false;
  voiceBus.emitUserText('what time is it');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (!responseReceived) {
    console.log('✅ Correctly blocked (no wake word)');
  } else {
    console.error('❌ Should have been blocked but got response!');
  }
  
  // Clean up
  unsubscribe();
  
  console.log('\n📊 === TEST COMPLETE ===\n');
}

// Auto-expose
if (import.meta.env.DEV) {
  (window as any).finalTest = finalTest;
  console.log('[FinalTest] Ready: await finalTest()');
}