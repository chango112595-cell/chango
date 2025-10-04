/**
 * Test API Endpoint Integration
 * Verifies that the responder service correctly communicates with the backend NLP endpoint
 */

async function testApiEndpoint() {
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
        text: 'Hello, how are you?',
        context: {
          source: 'test',
          testRun: true
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend response:', data);
      
      // Verify response structure
      if (data.ok && data.reply) {
        console.log('✅ Response has correct structure');
        console.log('   Reply:', data.reply);
        console.log('   Confidence:', data.confidence);
      } else {
        console.error('❌ Response structure is incorrect:', data);
      }
    } else {
      console.error('❌ API returned error status:', response.status);
      const text = await response.text();
      console.error('   Response body:', text);
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
  
  console.log('\n-------------------\n');
  
  // Test 2: Test via responder service
  console.log('Test 2: Testing via responder service');
  try {
    // Import responder dynamically to test it
    const { respond } = await import('../src/services/responder');
    
    const result = await respond('What time is it?', {
      source: 'test',
      responseType: 'text',
      metadata: { testRun: true }
    });
    
    console.log('✅ Responder returned:', result);
  } catch (error) {
    console.error('❌ Responder test failed:', error);
  }
  
  console.log('\n-------------------\n');
  
  // Test 3: Test with various message types
  console.log('Test 3: Testing various message types');
  const testMessages = [
    'Tell me a joke',
    'What is your name?',
    'How can you help me?',
    'Random gibberish asdfqwerty'
  ];
  
  for (const message of testMessages) {
    try {
      const response = await fetch('/api/nlp/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: message,
          context: { source: 'test' }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ "${message}" → "${data.reply?.substring(0, 50)}..."`);
      } else {
        console.error(`❌ "${message}" → Error ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ "${message}" → Failed:`, error);
    }
  }
  
  console.log('\n🧪 Test complete!');
}

// Run the test when this module is loaded
if (typeof window !== 'undefined') {
  // Add test to window for easy access from console
  (window as any).testApiEndpoint = testApiEndpoint;
  console.log('API Endpoint test loaded. Run testApiEndpoint() in the console to test.');
} else {
  // If running in Node environment
  testApiEndpoint();
}

export { testApiEndpoint };