# Wake Word "lolo" Testing Instructions

## Test Script Location
The complete test script is in: `client/src/tests/BROWSER_CONSOLE_TEST.js`

## How to Run the Tests

### Method 1: Browser Console Test (Recommended)
1. Open the application in your browser
2. Open the browser developer console (F12 or right-click → Inspect → Console)
3. Copy the entire contents of `client/src/tests/BROWSER_CONSOLE_TEST.js`
4. Paste it into the console and press Enter
5. Watch the test results appear in the console

### Method 2: Using Pre-loaded Test Functions
If the test functions are loaded, you can run them directly in the console:

```javascript
// Test 1: Conversation Flow Test
await testConversationFlow()

// Test 2: Debug Wake Word Test  
await debugWakeWord()

// Test 3: Manual Test
await manualTest()

// Test 4: Final Test
await finalTest()

// Test 5: Simple Wake Word Test
await simpleWakeWordTest()

// Test 6: Comprehensive Test
await comprehensiveWakeWordTest()
```

## Expected Test Results

### ✅ PASS Criteria:
1. Messages with "lolo" prefix get responses
2. Messages without "lolo" are blocked
3. Just "lolo" alone gets an acknowledgment ("Yes?")
4. Voice input with "lolo" works
5. Voice input without "lolo" is blocked

### Test Cases:
| Input | Expected Result |
|-------|----------------|
| "what time is it" | ❌ Blocked (no wake word) |
| "lolo what time is it" | ✅ Response with current time |
| "lolo" | ✅ Acknowledgment ("Yes?") |
| "lolo what is today" | ✅ Response with current date |
| Voice: "lolo hello" | ✅ Greeting response |
| Voice: "hello" | ❌ Blocked (no wake word) |

## Debugging

### Check Module Availability
Run this in the console to check which modules are available:
```javascript
console.log('voiceBus:', !!window.voiceBus);
console.log('conversationEngine:', !!window.conversationEngine);
console.log('listeningGate:', !!window.listeningGate);
console.log('responder:', !!window.responder);
```

### Manual Testing
You can manually test the wake word by typing in the chat input:
1. Type "what time is it" → Should NOT get a response
2. Type "lolo what time is it" → Should get time response
3. Type "lolo" → Should get "Yes?" acknowledgment

### Check Event Flow
To see the detailed event flow, run:
```javascript
// Enable debug logging
window.voiceBus.on('*', (event) => console.log('Event:', event));
```

## Common Issues and Solutions

### Issue: No modules available
**Solution:** Refresh the page and wait for full initialization

### Issue: ConversationEngine not exposed
**Solution:** Check that the app is in DEV mode and bootstrap completed

### Issue: No responses received
**Solution:** Check that the gate module is loaded and wake word is configured

### Issue: All messages blocked
**Solution:** Verify wake word is set to "lolo" in configuration

## Verification Checklist

- [ ] voiceBus module is available
- [ ] conversationEngine is exposed to window
- [ ] listeningGate module is loaded
- [ ] Messages without "lolo" are blocked
- [ ] Messages with "lolo" get responses
- [ ] changoResponse events are emitted
- [ ] Voice simulation works with wake word
- [ ] TTS speaks the responses

## Test Status
- Test scripts created: ✅
- Module availability: ✅ (ConversationEngine exposed)
- Wake word configuration: ✅ (set to "lolo")
- Gate filtering: 🔄 (needs verification via console test)
- Response generation: 🔄 (needs verification via console test)