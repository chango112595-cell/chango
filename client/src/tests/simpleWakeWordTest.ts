/**
 * Simple Wake Word Test
 * Can be run manually in browser console
 */

export async function simpleWakeWordTest() {
  console.log('\n🔬 === SIMPLE WAKE WORD TEST ===\n');
  
  const voiceBus = (window as any).voiceBus;
  const conversationEngine = (window as any).conversationEngine;
  
  if (!voiceBus) {
    console.error('❌ VoiceBus not available!');
    return;
  }
  
  console.log('✅ VoiceBus available');
  
  if (!conversationEngine) {
    console.error('❌ ConversationEngine not exposed! Checking modules...');
    // Try to find it
    const modules = Object.keys(window).filter(k => k.includes('conversation') || k.includes('engine'));
    console.log('Found window properties:', modules);
  } else {
    console.log('✅ ConversationEngine available');
  }
  
  let responses: string[] = [];
  
  // Listen for responses
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    console.log('🎉 RESPONSE:', event.text);
    responses.push(event.text);
  });
  
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Run tests
  console.log('\n📝 Testing wake word functionality...\n');
  
  // Test 1: Without wake word (should be blocked)
  console.log('Test 1: "what time is it" (no wake word)');
  voiceBus.emitUserText('what time is it');
  await wait(1000);
  console.log('Responses so far:', responses.length);
  
  // Test 2: With wake word (should get response)
  console.log('\nTest 2: "lolo what time is it"');
  voiceBus.emitUserText('lolo what time is it');
  await wait(2000);
  console.log('Responses so far:', responses.length);
  if (responses.length > 0) {
    console.log('Last response:', responses[responses.length - 1]);
  }
  
  // Test 3: Just wake word (should get acknowledgment)
  console.log('\nTest 3: "lolo" (just wake word)');
  voiceBus.emitUserText('lolo');
  await wait(1500);
  console.log('Responses so far:', responses.length);
  if (responses.length > 0) {
    console.log('Last response:', responses[responses.length - 1]);
  }
  
  // Test 4: Different command with wake word
  console.log('\nTest 4: "lolo what is today"');
  voiceBus.emitUserText('lolo what is today');
  await wait(2000);
  console.log('Responses so far:', responses.length);
  if (responses.length > 0) {
    console.log('Last response:', responses[responses.length - 1]);
  }
  
  unsubscribe();
  
  console.log('\n📊 === SUMMARY ===');
  console.log('Total responses received:', responses.length);
  console.log('All responses:', responses);
  
  if (responses.length >= 3) {
    console.log('✅ Wake word is WORKING!');
  } else {
    console.error('❌ Wake word might not be working properly');
    console.log('Expected at least 3 responses, got', responses.length);
  }
}

// Auto-expose to window
if (import.meta.env.DEV) {
  (window as any).simpleWakeWordTest = simpleWakeWordTest;
  console.log('[SimpleWakeWordTest] Test ready: await simpleWakeWordTest()');
}