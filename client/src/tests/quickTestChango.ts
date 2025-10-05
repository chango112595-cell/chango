// Quick test to verify Chango is working properly
console.log('🧪 QUICK CHANGO TEST - Running...');

// Test function to verify Chango responds to actual commands
export async function quickTestChango() {
  const voiceBus = (window as any).voiceBus;
  
  if (!voiceBus) {
    console.error('❌ Voice bus not available');
    return;
  }
  
  console.log('\n📝 Testing Chango with real commands...\n');
  
  // Test 1: Hello greeting
  console.log('Test 1: Sending "Hello"...');
  voiceBus.emit({ 
    type: 'userTextSubmitted', 
    text: 'Hello',
    source: 'test'
  });
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Ask for time
  console.log('\nTest 2: Sending "What time is it?"...');
  voiceBus.emit({ 
    type: 'userTextSubmitted', 
    text: 'What time is it?',
    source: 'test'
  });
  
  // Wait for response  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Ask for date
  console.log('\nTest 3: Sending "What is today\'s date?"...');
  voiceBus.emit({ 
    type: 'userTextSubmitted', 
    text: "What is today's date?",
    source: 'test'
  });
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 4: Ask who Chango is
  console.log('\nTest 4: Sending "Who are you?"...');
  voiceBus.emit({ 
    type: 'userTextSubmitted', 
    text: 'Who are you?',
    source: 'test'
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n✅ Tests sent! Check the chat for Chango\'s responses.\n');
  console.log('📌 Expected responses:');
  console.log('  1. "Hello" → Chango introduces himself');
  console.log('  2. "What time is it?" → Current time');
  console.log('  3. "What is today\'s date?" → Today\'s date');
  console.log('  4. "Who are you?" → Chango\'s identity\n');
  
  console.log('💡 TIP: If you see these responses in the chat, Chango is working!');
  console.log('💡 For voice commands, say "lolo" (not "lola") followed by your command.');
}

// Auto-run the test
(window as any).quickTestChango = quickTestChango;

// Run immediately when loaded
setTimeout(() => {
  console.log('\n🚀 Running Chango test automatically...');
  quickTestChango();
}, 2000);

export {};