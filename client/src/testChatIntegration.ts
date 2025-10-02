/**
 * Test file to verify conversation engine integration with Chat
 * Run this in the browser console to test the integration
 */

import { voiceBus } from './voice/voiceBus';

// Test helper to simulate chat messages
export function testChatIntegration() {
  console.log('=== Starting Chat Integration Test ===');
  
  // Set up response listener
  const responses: string[] = [];
  const unsubscribe = voiceBus.on('changoResponse', (event) => {
    console.log('✅ Received response:', event.text);
    responses.push(event.text || '');
  });
  
  // Test cases
  const testCases = [
    { 
      input: "what time is it", 
      expectedPattern: /current time is \d{1,2}:\d{2} (AM|PM)/i,
      description: "Time intent"
    },
    { 
      input: "who are you", 
      expectedPattern: /chango/i,
      description: "Identity intent"
    },
    { 
      input: "what's the date today",
      expectedPattern: /today is/i,
      description: "Date intent"
    },
    { 
      input: "how are you",
      expectedPattern: /functioning|great|excellent|operational|ready/i,
      description: "Mood intent"
    },
    { 
      input: "hello",
      expectedPattern: /hello|hi|greetings/i,
      description: "Greeting"
    },
    {
      input: "what is 5 plus 3",
      expectedPattern: /5 plus 3 equals 8/i,
      description: "Math operation"
    }
  ];
  
  console.log(`Running ${testCases.length} test cases...`);
  
  // Run tests sequentially
  let currentTest = 0;
  
  const runNextTest = () => {
    if (currentTest >= testCases.length) {
      console.log('=== Test Complete ===');
      console.log(`Total responses received: ${responses.length}`);
      unsubscribe();
      return;
    }
    
    const test = testCases[currentTest];
    console.log(`\nTest ${currentTest + 1}: ${test.description}`);
    console.log(`Input: "${test.input}"`);
    
    // Listen for the response
    const responseListener = voiceBus.on('changoResponse', (event) => {
      if (event.text) {
        const passed = test.expectedPattern.test(event.text);
        console.log(`Response: "${event.text}"`);
        console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        
        // Clean up this listener
        responseListener();
        
        // Move to next test after a delay
        currentTest++;
        setTimeout(runNextTest, 1000);
      }
    });
    
    // Emit the test message
    voiceBus.emitUserText(test.input);
  };
  
  // Start the test sequence
  setTimeout(runNextTest, 500);
  
  return {
    stop: () => {
      unsubscribe();
      console.log('Test stopped');
    }
  };
}

// Export for manual testing
export function sendTestMessage(message: string) {
  console.log(`Sending test message: "${message}"`);
  
  // Listen for response once
  const unsubscribe = voiceBus.on('changoResponse', (event) => {
    if (event.text) {
      console.log(`Received response: "${event.text}"`);
      unsubscribe();
    }
  });
  
  // Send the message
  voiceBus.emitUserText(message);
  
  // Timeout after 5 seconds
  setTimeout(() => {
    unsubscribe();
    console.log('No response received within 5 seconds');
  }, 5000);
}

// Make functions available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testChatIntegration = testChatIntegration;
  (window as any).sendTestMessage = sendTestMessage;
  console.log('Test functions available:');
  console.log('- testChatIntegration() : Run all integration tests');
  console.log('- sendTestMessage("your message") : Send a single test message');
}