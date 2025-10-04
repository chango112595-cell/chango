/**
 * Debug script for testing wake word and conversation flow
 * Run in browser console: await debugWakeWord()
 */

export async function debugWakeWord() {
  console.log('\n🔍 === WAKE WORD DEBUG TEST ===\n');
  
  const voiceBus = (window as any).voiceBus;
  if (!voiceBus) {
    console.error('❌ VoiceBus not available!');
    return;
  }
  
  console.log('✅ VoiceBus is available');
  
  // Listen for changoResponse events
  let responseReceived = false;
  let responseText = '';
  
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    console.log('🎉 changoResponse EVENT RECEIVED!', event);
    responseReceived = true;
    responseText = event.text;
  });
  
  // TEST 1: Without wake word
  console.log('\n📝 Test 1: WITHOUT wake word');
  console.log('   Input: "what time is it"');
  responseReceived = false;
  
  voiceBus.emitUserText('what time is it');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!responseReceived) {
    console.log('✅ Correctly blocked (no wake word)');
  } else {
    console.error('❌ Should have been blocked!');
  }
  
  // TEST 2: WITH wake word
  console.log('\n📝 Test 2: WITH wake word "lolo"');
  console.log('   Input: "lolo what time is it"');
  responseReceived = false;
  
  voiceBus.emitUserText('lolo what time is it');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (responseReceived) {
    console.log('✅ Response received:', responseText);
  } else {
    console.error('❌ NO RESPONSE - Debugging needed!');
    console.error('   The wake word was present but no response generated');
  }
  
  // TEST 3: Just wake word
  console.log('\n📝 Test 3: Just wake word alone');
  console.log('   Input: "lolo"');
  responseReceived = false;
  
  voiceBus.emitUserText('lolo');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (responseReceived) {
    console.log('✅ Acknowledgment received:', responseText);
  } else {
    console.error('❌ No acknowledgment for wake word ping');
  }
  
  // TEST 4: Different command with wake word
  console.log('\n📝 Test 4: Different command');
  console.log('   Input: "lolo what is today"');
  responseReceived = false;
  
  voiceBus.emitUserText('lolo what is today');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (responseReceived) {
    console.log('✅ Date response received:', responseText);
  } else {
    console.error('❌ No date response received');
  }
  
  // Clean up
  unsubscribe();
  
  console.log('\n📊 === TEST COMPLETE ===');
  console.log('Check the results above to identify where the issue is.');
  
  return { success: responseReceived };
}

// Auto-expose to window
if (import.meta.env.DEV) {
  (window as any).debugWakeWord = debugWakeWord;
  console.log('[DebugWakeWord] Test ready: await debugWakeWord()');
}