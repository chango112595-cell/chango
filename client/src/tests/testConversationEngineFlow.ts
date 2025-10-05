/**
 * Test script to verify conversation engine flow is working properly
 * Tests: initialization, event listening, message processing, and error reporting
 */

export async function testConversationEngineFlow() {
  console.log('🔍 === STARTING CONVERSATION ENGINE FLOW TEST ===');
  console.log('Timestamp:', new Date().toISOString());
  
  const results = {
    engineInitialized: false,
    engineExposed: false,
    listenersActive: false,
    messageProcessing: false,
    responseReceived: false,
    healthChecksActive: false,
    criticalAlertsWorking: false
  };
  
  // Test 1: Check if conversation engine is initialized
  console.log('\n📋 TEST 1: Checking conversation engine initialization...');
  const engine = (window as any).conversationEngine;
  
  if (engine) {
    results.engineExposed = true;
    console.log('✅ Conversation Engine is exposed to window');
    
    // Check if it's initialized
    if (engine.isInitialized && engine.isInitialized()) {
      results.engineInitialized = true;
      console.log('✅ Conversation Engine is initialized');
    } else {
      console.error('❌ Conversation Engine NOT initialized');
    }
    
    // Check listeners
    if (engine.checkListeners) {
      const listeners = engine.checkListeners();
      console.log('Event Listeners:', listeners);
      results.listenersActive = !!(
        listeners.userTextSubmitted && 
        listeners.userSpeechRecognized
      );
    }
  } else {
    console.error('❌ CRITICAL: Conversation Engine is NOT exposed to window');
  }
  
  // Test 2: Test message processing
  console.log('\n📋 TEST 2: Testing message processing...');
  if (engine && engine.test) {
    try {
      // Add a temporary listener for changoResponse
      const voiceBus = (window as any).voiceBus;
      let responseReceived = false;
      
      const unsubscribe = voiceBus?.on('changoResponse', (event: any) => {
        console.log('  ✓ changoResponse event received:', event.text);
        responseReceived = true;
        results.responseReceived = true;
      });
      
      console.log('  Sending test message: "lolo what time is it"');
      await engine.test();
      
      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (responseReceived) {
        console.log('✅ Message processing and response generation working!');
        results.messageProcessing = true;
      } else {
        console.error('❌ CRITICAL: changoResponse was NOT received');
        console.error('   Problem is in conversation engine processing or response generation');
        console.error('   Check if conversation engine is initialized and listening');
      }
      
      if (unsubscribe) unsubscribe();
    } catch (error) {
      console.error('❌ Error during message processing test:', error);
    }
  } else {
    console.error('❌ Cannot test message processing - engine not available');
  }
  
  // Test 3: Check health monitoring
  console.log('\n📋 TEST 3: Checking health monitoring...');
  const diag = (window as any).__CH_DEBUG__;
  
  if (diag) {
    console.log('✅ Debug bus is available');
    results.healthChecksActive = true;
    
    // Get recent events
    const events = diag.getEvents();
    const conversationEvents = events.filter((e: any) => 
      e.module === 'ConversationEngine' || 
      e.domain === 'conversation'
    );
    
    console.log('  Recent conversation engine events:', conversationEvents.length);
    
    // Check for critical issues
    const criticalIssues = events.filter((e: any) => 
      e.severity === 'critical' || 
      (e.severity === 'error' && e.domain === 'conversation')
    );
    
    if (criticalIssues.length > 0) {
      console.warn('  ⚠️ Critical issues detected:', criticalIssues);
      results.criticalAlertsWorking = true;
    }
  } else {
    console.warn('⚠️ Debug bus not available');
  }
  
  // Test 4: Check event flow
  console.log('\n📋 TEST 4: Testing event flow...');
  const voiceBus = (window as any).voiceBus;
  
  if (voiceBus) {
    console.log('  Testing userTextSubmitted event flow...');
    
    // Emit a test event
    voiceBus.emitUserText('test message flow');
    console.log('  Event emitted, checking if it reaches conversation engine...');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check debug bus for processing
    if (diag) {
      const recentEvents = diag.getEvents();
      const processedEvent = recentEvents.find((e: any) => 
        e.message && e.message.includes('RECEIVED userTextSubmitted')
      );
      
      if (processedEvent) {
        console.log('✅ Event flow working - message reached conversation engine');
      } else {
        console.error('❌ Event flow broken - message did not reach conversation engine');
      }
    }
  }
  
  // Final Report
  console.log('\n📊 DIAGNOSTIC RESULTS:');
  console.log('================================');
  console.log(`Engine Initialized: ${results.engineInitialized ? '✅' : '❌'}`);
  console.log(`Engine Exposed: ${results.engineExposed ? '✅' : '❌'}`);
  console.log(`Listeners Active: ${results.listenersActive ? '✅' : '❌'}`);
  console.log(`Message Processing: ${results.messageProcessing ? '✅' : '❌'}`);
  console.log(`Response Received: ${results.responseReceived ? '✅' : '❌'}`);
  console.log(`Health Checks: ${results.healthChecksActive ? '✅' : '❌'}`);
  console.log(`Critical Alerts: ${results.criticalAlertsWorking ? '✅' : '❌'}`);
  console.log('================================');
  
  const allPassed = Object.values(results).every(v => v === true);
  
  if (allPassed) {
    console.log('✅ SUCCESS: Complete message flow is working!');
  } else {
    console.error('❌ FAILURE: Some components are not working properly');
    console.log('Recommendations:');
    
    if (!results.engineInitialized) {
      console.log('  1. Run: window.bootstrapChango() to initialize the system');
    }
    if (!results.listenersActive) {
      console.log('  2. Check that event listeners are properly registered');
    }
    if (!results.messageProcessing) {
      console.log('  3. Check responder service and API endpoints');
    }
    if (!results.responseReceived) {
      console.log('  4. Check voiceBus event emission and subscription');
    }
  }
  
  console.log('\n🔍 === DIAGNOSTIC COMPLETE ===');
  
  // Also check if window.conversationEngine is exposed
  if ((window as any).conversationEngine) {
    console.log('Conversation Engine is exposed to window ✓');
    console.log('Available functions:', Object.keys((window as any).conversationEngine));
  }
  
  return results;
}

// Auto-run the test when loaded in dev mode
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Wait for system to initialize
  setTimeout(() => {
    testConversationEngineFlow().then(results => {
      console.log('Test complete. Check logs above for results.');
      
      // Store results in window for debugging
      (window as any).__lastConversationEngineTest = results;
    });
  }, 2000);
}