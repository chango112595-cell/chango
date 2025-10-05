/**
 * Inline test for typed message fix
 * This runs automatically when imported
 */

// Only run in development mode
if (import.meta.env.DEV) {
  console.log('');
  console.log('🧪 === INLINE TYPED MESSAGE TEST ===');
  
  // Import gate function directly
  import('../modules/listening/gate').then(({ passGate }) => {
    console.log('Testing gate logic after fix...');
    
    // Test typed messages (should ALWAYS pass)
    const typedTest = passGate('What time is it?', true);
    console.log('✅ Typed message WITHOUT wake word:', {
      allowed: typedTest.allowed,
      reason: typedTest.reason,
      text: typedTest.text
    });
    
    if (!typedTest.allowed) {
      console.error('❌ FAIL: Typed message was blocked! Fix not applied correctly.');
    } else {
      console.log('✅ SUCCESS: Typed messages now bypass wake word requirement!');
    }
    
    // Test spoken messages (should require wake word)
    const spokenTest = passGate('What time is it?', false);
    console.log('✅ Spoken message WITHOUT wake word:', {
      allowed: spokenTest.allowed,
      reason: spokenTest.reason,
      text: spokenTest.text
    });
    
    const spokenWithWake = passGate('lolo what time is it?', false);
    console.log('✅ Spoken message WITH wake word:', {
      allowed: spokenWithWake.allowed,
      reason: spokenWithWake.reason,
      text: spokenWithWake.text
    });
    
    console.log('');
    console.log('🎯 === TEST SUMMARY ===');
    console.log('Gate fix status:');
    console.log('  - Typed messages bypass wake word: ' + (typedTest.allowed ? '✅ FIXED' : '❌ NOT FIXED'));
    console.log('  - Spoken messages require wake word: ' + (!spokenTest.allowed ? '✅ WORKING' : '⚠️ CHECK FEATURES'));
    console.log('  - Wake word detection for speech: ' + (spokenWithWake.allowed ? '✅ WORKING' : '❌ BROKEN'));
    console.log('');
    
    // Now test with voice bus
    import('../voice/voiceBus').then(({ voiceBus }) => {
      console.log('Testing full pipeline with voiceBus...');
      console.log('Emitting typed message: "What time is it?"');
      
      // Listen for response
      const unsubscribe = voiceBus.on('changoResponse', (event) => {
        console.log('🎉 SUCCESS: changoResponse received!', event.text);
      });
      
      // Emit typed message
      voiceBus.emit({
        type: 'userTextSubmitted',
        text: 'What time is it?',
        source: 'system'
      });
      
      // Clean up after 2 seconds
      setTimeout(() => {
        unsubscribe();
        console.log('Test complete. Check logs above for results.');
      }, 2000);
    });
  }).catch(error => {
    console.error('Failed to load gate module:', error);
  });
}