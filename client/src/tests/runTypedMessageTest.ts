/**
 * Runner for typed message fix test
 * Import and execute the test in the browser console
 */

import { testTypedMessageFix } from './testTypedMessageFix';

// Run the test immediately
console.log('🚀 Running typed message fix test...');
testTypedMessageFix().then(result => {
  if (result) {
    console.log('✅ Test passed!');
  } else {
    console.log('❌ Test failed!');
  }
}).catch(error => {
  console.error('❌ Test error:', error);
});

// Also expose to window
(window as any).runTypedMessageTest = testTypedMessageFix;