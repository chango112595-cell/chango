/**
 * Manual Test Script to Debug Conversation Flow
 * Run in browser console: await manualTest()
 */

export async function manualTest() {
  console.log('\n🔬 === MANUAL CONVERSATION TEST ===\n');
  
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  const listeningGate = (window as any).listeningGate;
  const responder = (window as any).responder;
  
  // Verify all modules are available
  if (!voiceBus || !conversationEngine || !listeningGate) {
    console.error('❌ Required modules not available');
    return;
  }
  
  console.log('✅ All modules loaded');
  
  // Listen for changoResponse
  let responseCount = 0;
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    responseCount++;
    console.log(`🎉 [${responseCount}] changoResponse received:`, event.text);
  });
  
  // Test 1: Direct route test
  console.log('\n📝 Test 1: Direct route function');
  const routeResult = conversationEngine.route('what time is it');
  console.log('   Route result:', routeResult);
  
  // Test 2: Direct respond function (this should emit changoResponse)
  console.log('\n📝 Test 2: Direct respond function');
  if (responder) {
    console.log('   Calling responder.respond directly...');
    const response = await responder.respond('what time is it', {
      source: 'text',
      responseType: 'both'
    });
    console.log('   Direct responder result:', response);
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('   changoResponse count after responder:', responseCount);
  }
  
  // Test 3: Direct conversation engine handle with wake word
  console.log('\n📝 Test 3: Direct handle with wake word');
  responseCount = 0;
  console.log('   Calling conversationEngine.handle("lolo what time is it", true)...');
  await conversationEngine.handle('lolo what time is it', true);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('   changoResponse count after handle:', responseCount);
  
  // Test 4: Via voiceBus emission
  console.log('\n📝 Test 4: Via voiceBus.emitUserText');
  responseCount = 0;
  console.log('   Emitting "lolo what date is today"...');
  voiceBus.emitUserText('lolo what date is today');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('   changoResponse count after voiceBus:', responseCount);
  
  // Test 5: Check gate directly
  console.log('\n📝 Test 5: Gate check');
  const gateResult1 = listeningGate.passGate('what time is it', true);
  const gateResult2 = listeningGate.passGate('lolo what time is it', true);
  console.log('   Without wake word:', gateResult1);
  console.log('   With wake word:', gateResult2);
  
  // Clean up
  unsubscribe();
  
  console.log('\n📊 === SUMMARY ===');
  console.log('Total changoResponse events received:', responseCount);
  if (responseCount === 0) {
    console.error('❌ CRITICAL: No changoResponse events were received!');
    console.error('   The issue is in the response emission chain');
  } else {
    console.log('✅ changoResponse events are being emitted');
  }
}

// Auto-expose
if (import.meta.env.DEV) {
  (window as any).manualTest = manualTest;
  console.log('[ManualTest] Ready: await manualTest()');
}