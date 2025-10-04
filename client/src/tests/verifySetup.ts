/**
 * Verify Conversation Engine Setup
 * Run this in browser console to check if everything is initialized correctly
 */

export function verifySetup() {
  console.log('\n🔍 === VERIFYING CONVERSATION ENGINE SETUP ===\n');
  
  // Step 1: Check if modules are exposed
  console.log('📋 STEP 1: Checking exposed modules...');
  
  const hasVoiceBus = !!(window as any).voiceBus;
  const hasConversationEngine = !!(window as any).conversationEngine;
  const hasListeningGate = !!(window as any).listeningGate;
  
  console.log('  voiceBus:', hasVoiceBus ? '✅ Available' : '❌ NOT FOUND');
  console.log('  conversationEngine:', hasConversationEngine ? '✅ Available' : '❌ NOT FOUND');
  console.log('  listeningGate:', hasListeningGate ? '✅ Available' : '❌ NOT FOUND');
  
  if (!hasVoiceBus || !hasConversationEngine || !hasListeningGate) {
    console.error('\n❌ CRITICAL: Required modules not exposed to window!');
    console.log('\n🔧 FIX REQUIRED:');
    console.log('  1. Check that bootstrap.ts calls initConversationEngine()');
    console.log('  2. Check that modules export to window in DEV mode');
    console.log('  3. Refresh the page after server restart');
    return false;
  }
  
  // Step 2: Check conversation engine functions
  console.log('\n📋 STEP 2: Checking conversation engine functions...');
  const engine = (window as any).conversationEngine;
  const requiredFunctions = ['route', 'handle', 'respond', 'checkListeners'];
  
  for (const func of requiredFunctions) {
    const hasFunc = typeof engine[func] === 'function';
    console.log(`  ${func}:`, hasFunc ? '✅ Available' : '❌ NOT FOUND');
    if (!hasFunc) {
      console.error(`    Missing function: ${func}`);
    }
  }
  
  // Step 3: Check event listeners
  console.log('\n📋 STEP 3: Checking event listeners...');
  if (engine.checkListeners) {
    const listeners = engine.checkListeners();
    console.log('  Event listeners registered:');
    console.log('    userSpeechRecognized:', listeners.userSpeechRecognized ? '✅' : '❌');
    console.log('    userTextSubmitted:', listeners.userTextSubmitted ? '✅' : '❌');
    console.log('    cancel:', listeners.cancel ? '✅' : '❌');
    console.log('    muteChange:', listeners.muteChange ? '✅' : '❌');
    
    if (!listeners.userTextSubmitted) {
      console.error('\n❌ CRITICAL: userTextSubmitted listener not registered!');
      console.log('  This means the conversation engine won\'t receive text input');
    }
  }
  
  // Step 4: Test simple routing
  console.log('\n📋 STEP 4: Testing routing function...');
  try {
    const timeResponse = engine.route('what time is it');
    console.log('  route("what time is it"):', timeResponse ? '✅ Returns response' : '❌ No response');
    if (timeResponse) {
      console.log('    Response:', timeResponse.substring(0, 50) + '...');
    }
  } catch (error) {
    console.error('  ❌ Error calling route():', error);
  }
  
  // Step 5: Test event emission
  console.log('\n📋 STEP 5: Testing event flow...');
  const voiceBus = (window as any).voiceBus;
  
  return new Promise((resolve) => {
    let responseReceived = false;
    
    // Set up listener
    const unsubscribe = voiceBus.on('changoResponse', (event: any) => {
      responseReceived = true;
      console.log('  ✅ changoResponse event received!');
      console.log('    Response:', event.text);
      unsubscribe();
      
      // Final verdict
      console.log('\n🎉 === SETUP VERIFICATION COMPLETE ===');
      console.log('✅ All systems operational!');
      console.log('  - Modules exposed correctly');
      console.log('  - Event listeners registered');
      console.log('  - Event flow working');
      console.log('  - Conversation engine responding');
      
      resolve(true);
    });
    
    // Emit test event with wake word
    console.log('  Emitting test event: "lolo what time is it"');
    voiceBus.emit({
      type: 'userTextSubmitted',
      text: 'lolo what time is it',
      source: 'user'
    });
    
    // Timeout after 2 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.error('\n❌ CRITICAL: No changoResponse received after 2 seconds!');
        console.log('\n🔍 DEBUGGING HINTS:');
        console.log('  1. Check browser console for [ConversationEngine] logs');
        console.log('  2. Check if gate is blocking the message');
        console.log('  3. Check if responder service is working');
        console.log('  4. Check for any errors in console');
        
        unsubscribe();
        resolve(false);
      }
    }, 2000);
  });
}

// Auto-run verification on load in dev mode
if (import.meta.env.DEV) {
  (window as any).verifySetup = verifySetup;
  
  // Run automatically after a short delay to ensure everything is loaded
  setTimeout(() => {
    console.log('[VerifySetup] Running automatic verification...');
    verifySetup().then(result => {
      if (result) {
        console.log('[VerifySetup] ✅ Setup verified successfully!');
      } else {
        console.error('[VerifySetup] ❌ Setup verification failed!');
      }
    });
  }, 2000);
}