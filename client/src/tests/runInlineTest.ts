/**
 * Inline test for wake word functionality
 * Execute directly in browser console
 */

export function runInlineWakeWordTest() {
  // This test will run directly in the browser console
  const testCode = `
(async function() {
  console.log('\\n🧪 === INLINE WAKE WORD TEST ===\\n');
  
  // Check module availability
  const voiceBus = window.voiceBus;
  const conversationEngine = window.conversationEngine;
  const listeningGate = window.listeningGate;
  const responder = window.responder;
  
  console.log('📦 Module Status:');
  console.log('  VoiceBus:', !!voiceBus ? '✅ Available' : '❌ Missing');
  console.log('  ConversationEngine:', !!conversationEngine ? '✅ Available' : '❌ Missing');
  console.log('  ListeningGate:', !!listeningGate ? '✅ Available' : '❌ Missing');
  console.log('  Responder:', !!responder ? '✅ Available' : '❌ Missing');
  
  if (!voiceBus) {
    console.error('CRITICAL: voiceBus not available!');
    return;
  }
  
  let responseReceived = false;
  let responseText = '';
  
  // Listen for responses
  const unsubscribe = voiceBus.on('changoResponse', (event) => {
    console.log('🎉 changoResponse received:', event.text);
    responseReceived = true;
    responseText = event.text;
  });
  
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // TEST 1: Without wake word
  console.log('\\n📝 Test 1: WITHOUT wake word "what time is it"');
  responseReceived = false;
  voiceBus.emitUserText('what time is it');
  await wait(1000);
  console.log('  Result:', responseReceived ? '❌ Got unexpected response' : '✅ Correctly blocked');
  
  // TEST 2: WITH wake word
  console.log('\\n📝 Test 2: WITH wake word "lolo what time is it"');
  responseReceived = false;
  voiceBus.emitUserText('lolo what time is it');
  await wait(2000);
  if (responseReceived) {
    console.log('  ✅ Response received:', responseText);
  } else {
    console.error('  ❌ No response received!');
  }
  
  // TEST 3: Just wake word
  console.log('\\n📝 Test 3: Just wake word "lolo"');
  responseReceived = false;
  voiceBus.emitUserText('lolo');
  await wait(1500);
  if (responseReceived) {
    console.log('  ✅ Acknowledgment:', responseText);
  } else {
    console.error('  ❌ No acknowledgment!');
  }
  
  // TEST 4: Date command
  console.log('\\n📝 Test 4: "lolo what is today"');
  responseReceived = false;
  voiceBus.emitUserText('lolo what is today');
  await wait(2000);
  if (responseReceived) {
    console.log('  ✅ Date response:', responseText);
  } else {
    console.error('  ❌ No response!');
  }
  
  // TEST 5: Voice simulation
  console.log('\\n📝 Test 5: Voice input "lolo hello"');
  responseReceived = false;
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'lolo hello',
    source: 'stt'
  });
  await wait(2000);
  if (responseReceived) {
    console.log('  ✅ Voice response:', responseText);
  } else {
    console.error('  ❌ No voice response!');
  }
  
  // TEST 6: Voice without wake word
  console.log('\\n📝 Test 6: Voice input "hello" (no wake word)');
  responseReceived = false;
  voiceBus.emit({
    type: 'userSpeechRecognized',
    text: 'hello',
    source: 'stt'
  });
  await wait(1000);
  console.log('  Result:', responseReceived ? '❌ Got unexpected response' : '✅ Correctly blocked');
  
  unsubscribe();
  
  console.log('\\n📊 === TEST COMPLETE ===');
  console.log('Check the results above to verify wake word functionality');
})();
  `;
  
  // Execute the test code
  try {
    eval(testCode);
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Auto-run on load
if (import.meta.env.DEV) {
  // Delay to ensure everything is loaded
  setTimeout(() => {
    console.log('[InlineTest] Running wake word test...');
    runInlineWakeWordTest();
  }, 2000);
}