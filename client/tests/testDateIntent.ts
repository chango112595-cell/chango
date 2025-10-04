/**
 * Test script to verify the date intent matching in the conversation engine
 * Run this in the browser console to test the fix
 */

import { route } from './modules/conversationEngine/index';

export function testDateIntentMatching() {
  console.log('========================================');
  console.log('Testing Date Intent Matching');
  console.log('========================================\n');
  
  const testCases = [
    'what is today',
    'What is today?',
    'what\'s today',
    'what\'s today?',
    'today\'s date',
    'what is the date',
    'what is the current date',
    'what day is it',
    'which day is today',
    'tell me today\'s date',
  ];
  
  let passedCount = 0;
  let failedCount = 0;
  
  testCases.forEach((testCase) => {
    console.log(`Testing: "${testCase}"`);
    const response = route(testCase);
    
    if (response && response.includes('Today is')) {
      console.log('✅ PASSED - Response:', response);
      passedCount++;
    } else {
      console.log('❌ FAILED - Response:', response || 'null (no match)');
      failedCount++;
    }
    console.log('----------------------------------------');
  });
  
  console.log('\n========================================');
  console.log(`Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('========================================');
  
  // Test that a non-date query doesn't match
  console.log('\nNegative test - should NOT match date intent:');
  const nonDateQuery = 'tell me a joke';
  const nonDateResponse = route(nonDateQuery);
  if (!nonDateResponse || !nonDateResponse.includes('Today is')) {
    console.log('✅ Correctly did not match date intent for:', nonDateQuery);
  } else {
    console.log('❌ Incorrectly matched date intent for:', nonDateQuery);
  }
}

// Export for browser console
(window as any).testDateIntent = testDateIntentMatching;

// Auto-run if this script is loaded directly
if (typeof window !== 'undefined') {
  console.log('Date intent test loaded. Run testDateIntent() in console to test.');
}