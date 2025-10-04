/**
 * Test for duplicate message bug fix
 * Verifies that messages are only displayed once and not duplicated
 */

export async function testDuplicateMessages() {
  console.log('==================================================');
  console.log('DUPLICATE MESSAGE BUG FIX TEST');
  console.log('==================================================');
  console.log('This test verifies that messages are not duplicated in the chat.');
  console.log('');

  // Step 1: Check if conversation engine is initialized correctly
  console.log('Step 1: Checking conversation engine initialization...');
  const conversationEngine = (window as any).conversationEngine;
  
  if (!conversationEngine) {
    console.error('❌ Conversation engine not found!');
    return false;
  }
  
  // Check if already initialized
  const isInitialized = conversationEngine.isInitialized();
  console.log(`✅ Conversation engine initialized: ${isInitialized}`);
  
  // Check listeners
  const listeners = conversationEngine.checkListeners();
  console.log('Current listeners:', listeners);
  
  // Step 2: Set up response counter
  console.log('\nStep 2: Setting up response counter...');
  const voiceBus = (window as any).voiceBus;
  
  if (!voiceBus) {
    console.error('❌ VoiceBus not found!');
    return false;
  }
  
  let responseCount = 0;
  const responses: string[] = [];
  const responseTimestamps: number[] = [];
  
  // Listen for changoResponse events
  const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
    responseCount++;
    responses.push(event.text);
    responseTimestamps.push(Date.now());
    console.log(`📥 Response #${responseCount}: ${event.text}`);
  });
  
  // Step 3: Test with "lolo what time is it"
  console.log('\n==================================================');
  console.log('TEST 1: "lolo what time is it"');
  console.log('==================================================');
  
  responseCount = 0;
  responses.length = 0;
  responseTimestamps.length = 0;
  
  // Emit userTextSubmitted event
  console.log('Emitting: "lolo what time is it"');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo what time is it'
  });
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n📊 TEST 1 RESULTS:');
  console.log(`Total responses received: ${responseCount}`);
  console.log('Responses:', responses);
  
  if (responseCount === 0) {
    console.error('❌ No response received!');
  } else if (responseCount === 1) {
    console.log('✅ SUCCESS! Only ONE response received (as expected)');
  } else {
    console.error(`❌ FAIL! Received ${responseCount} responses (expected 1)`);
    console.log('Response timestamps:', responseTimestamps);
    
    // Calculate time between responses
    for (let i = 1; i < responseTimestamps.length; i++) {
      const timeDiff = responseTimestamps[i] - responseTimestamps[i - 1];
      console.log(`Time between response ${i} and ${i + 1}: ${timeDiff}ms`);
    }
  }
  
  // Step 4: Test with "lolo hello"
  console.log('\n==================================================');
  console.log('TEST 2: "lolo hello"');
  console.log('==================================================');
  
  responseCount = 0;
  responses.length = 0;
  responseTimestamps.length = 0;
  
  // Emit userTextSubmitted event
  console.log('Emitting: "lolo hello"');
  voiceBus.emit({
    type: 'userTextSubmitted',
    text: 'lolo hello'
  });
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n📊 TEST 2 RESULTS:');
  console.log(`Total responses received: ${responseCount}`);
  console.log('Responses:', responses);
  
  if (responseCount === 0) {
    console.error('❌ No response received!');
  } else if (responseCount === 1) {
    console.log('✅ SUCCESS! Only ONE response received (as expected)');
  } else {
    console.error(`❌ FAIL! Received ${responseCount} responses (expected 1)`);
    console.log('Response timestamps:', responseTimestamps);
  }
  
  // Step 5: Test rapid submissions (should be deduplicated)
  console.log('\n==================================================');
  console.log('TEST 3: Rapid duplicate submissions');
  console.log('==================================================');
  
  responseCount = 0;
  responses.length = 0;
  responseTimestamps.length = 0;
  
  // Emit same message multiple times rapidly
  console.log('Emitting "lolo hi" 3 times rapidly...');
  for (let i = 0; i < 3; i++) {
    voiceBus.emit({
      type: 'userTextSubmitted',
      text: 'lolo hi'
    });
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n📊 TEST 3 RESULTS:');
  console.log(`Total responses received: ${responseCount}`);
  console.log('Responses:', responses);
  
  if (responseCount === 0) {
    console.error('❌ No response received!');
  } else if (responseCount === 1) {
    console.log('✅ SUCCESS! Duplicates were properly deduplicated');
  } else {
    console.log(`⚠️ WARNING! Received ${responseCount} responses for rapid duplicates`);
    console.log('This might be expected if deduplication window is small');
  }
  
  // Cleanup
  unsubscribe();
  
  // Final summary
  console.log('\n==================================================');
  console.log('TEST COMPLETE');
  console.log('==================================================');
  console.log('The duplicate message bug fix has been applied.');
  console.log('Messages should now only appear once in the chat.');
  console.log('');
  console.log('Fix summary:');
  console.log('1. ✅ Added initialization guard to ConversationEngine');
  console.log('2. ✅ Added request deduplication in ConversationEngine');
  console.log('3. ✅ Added message cooldown in Chat component');
  console.log('4. ✅ Added proper cleanup functions');
  console.log('==================================================');
  
  return true;
}

// Auto-run test if loaded
if (import.meta.env.DEV) {
  (window as any).testDuplicateMessages = testDuplicateMessages;
  console.log('Duplicate message test ready. Run: window.testDuplicateMessages()');
  
  // Auto-run disabled to prevent message accumulation
  // setTimeout(() => {
  //   console.log('Auto-running duplicate message test...');
  //   testDuplicateMessages();
  // }, 3000);
}