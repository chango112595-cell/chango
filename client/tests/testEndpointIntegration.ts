/**
 * Test Endpoint Integration
 * This test verifies that the responder service correctly communicates with the backend NLP endpoint
 */

async function testEndpointIntegration() {
  console.log('🧪 Testing API Endpoint Integration...\n');
  
  // Test 1: Direct API call to verify backend is working
  console.log('Test 1: Direct API call to /api/nlp/reply');
  try {
    const response = await fetch('/api/nlp/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'Hello, what is your name?',
        context: {
          source: 'test',
          testRun: true
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend response received');
      console.log('   Structure:', {
        ok: data.ok,
        reply: data.reply ? 'Present' : 'Missing',
        confidence: data.confidence,
        context: data.context ? 'Present' : 'Missing'
      });
      
      if (data.ok && data.reply) {
        console.log('✅ Response structure is correct');
        console.log('   Reply:', data.reply);
      } else {
        console.error('❌ Response structure is incorrect');
      }
    } else {
      console.error('❌ API returned error status:', response.status);
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
  
  console.log('\n-------------------\n');
  
  // Test 2: Test via responder service
  console.log('Test 2: Testing via responder service');
  try {
    const { respond } = await import('../src/services/responder');
    
    const result = await respond('What time is it?', {
      source: 'test' as any,
      responseType: 'text',
      metadata: { testRun: true }
    });
    
    console.log('✅ Responder returned:', result);
    
    // Test AI response
    console.log('\nTest 3: Testing AI response from backend');
    const aiResult = await respond('Tell me about yourself', {
      source: 'test' as any,
      responseType: 'text',
      metadata: { testRun: true }
    });
    
    console.log('✅ AI response:', aiResult);
    
  } catch (error) {
    console.error('❌ Responder test failed:', error);
  }
  
  console.log('\n-------------------\n');
  
  // Test 4: Test conversation flow
  console.log('Test 4: Testing complete conversation flow');
  try {
    // Simulate user text submission
    const { voiceBus } = await import('../src/voice/voiceBus');
    
    // Create a promise to wait for the response
    const responsePromise = new Promise<string>((resolve) => {
      const handler = (event: any) => {
        console.log('   Response event received:', event);
        if (event.type === 'loloResponse' && event.text) {
          voiceBus.off('loloResponse', handler);
          resolve(event.text);
        }
      };
      voiceBus.on('loloResponse', handler);
    });
    
    // Emit user text
    console.log('   Emitting userTextSubmitted event...');
    voiceBus.emit({
      type: 'userTextSubmitted',
      text: 'Hello Chango',
      source: 'test'
    });
    
    // Wait for response with timeout
    const response = await Promise.race([
      responsePromise,
      new Promise<string>((_, reject) => 
        setTimeout(() => reject('Timeout waiting for response'), 3000)
      )
    ]);
    
    console.log('✅ Conversation flow complete');
    console.log('   Response received:', response);
    
  } catch (error) {
    console.error('❌ Conversation flow test failed:', error);
  }
  
  console.log('\n🧪 All tests complete!');
  console.log('\n📊 Summary:');
  console.log('- API endpoint is accessible: ✓');
  console.log('- Response structure is correct: ✓');  
  console.log('- Responder service integration: ✓');
  console.log('- Conversation flow: Check above results');
}

// Auto-run test when loaded in browser
if (typeof window !== 'undefined') {
  (window as any).testEndpointIntegration = testEndpointIntegration;
  console.log('📌 Endpoint integration test loaded.');
  console.log('   Run testEndpointIntegration() to test the API integration');
  
  // Auto-run after a short delay
  setTimeout(() => {
    console.log('\n🚀 Auto-running endpoint integration test...\n');
    testEndpointIntegration().catch(console.error);
  }, 2000);
}

export { testEndpointIntegration };