/**
 * Fix and verify conversation engine initialization
 * This script manually initializes the conversation engine if it's not already initialized
 */

import { initConversationEngine } from '@/modules/conversationEngine';
import { voiceBus } from '@/voice/voiceBus';

export async function fixConversationEngine() {
  console.log('\n🔧 === FIXING CONVERSATION ENGINE ===\n');
  
  // Step 1: Check if conversation engine is already exposed
  const isExposed = !!(window as any).conversationEngine;
  console.log('Step 1: Check if exposed to window:', isExposed ? '✅ Yes' : '❌ No');
  
  if (!isExposed) {
    console.log('\nStep 2: Manually initializing conversation engine...');
    
    try {
      // Call the initialization function
      initConversationEngine();
      console.log('✅ initConversationEngine() called successfully');
      
      // Wait a moment for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if it's now exposed
      const nowExposed = !!(window as any).conversationEngine;
      if (nowExposed) {
        console.log('✅ Conversation engine is now exposed to window!');
        const engine = (window as any).conversationEngine;
        console.log('Available functions:', Object.keys(engine));
      } else {
        console.error('❌ Failed to expose conversation engine to window');
        console.log('Check if import.meta.env.DEV is true');
      }
    } catch (error) {
      console.error('❌ Error initializing conversation engine:', error);
    }
  }
  
  // Step 3: Test the event flow
  console.log('\nStep 3: Testing event flow...');
  
  return new Promise((resolve) => {
    let responseReceived = false;
    
    // Set up listener for changoResponse
    const unsubscribe = voiceBus.on('changoResponse', (event) => {
      responseReceived = true;
      console.log('✅ changoResponse event received!');
      console.log('   Response text:', event.text);
      unsubscribe();
      
      console.log('\n🎉 === FIX COMPLETE ===');
      console.log('Conversation engine is working properly!');
      console.log('Event flow is functioning correctly');
      console.log('You can now use:');
      console.log('  - window.testConversationFlow() for full test');
      console.log('  - window.quickTest() for quick test');
      
      resolve(true);
    });
    
    // Emit test event
    console.log('Emitting test event: "lolo what time is it"');
    voiceBus.emit({
      type: 'userTextSubmitted',
      text: 'lolo what time is it',
      source: 'user'
    });
    
    // Timeout after 2 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.error('\n❌ No changoResponse received after 2 seconds');
        console.log('The conversation engine might not be processing events');
        console.log('Check the browser console for any errors');
        
        unsubscribe();
        resolve(false);
      }
    }, 2000);
  });
}

// Auto-run on load
if (import.meta.env.DEV) {
  (window as any).fixConversationEngine = fixConversationEngine;
  
  // Auto-run disabled to prevent message accumulation
  // setTimeout(() => {
  //   console.log('[FixConversationEngine] Running automatic fix...');
  //   fixConversationEngine();
  // }, 3000);
}