/**
 * Conversation Engine
 * Handles intent routing and text processing for voice interactions
 */

import { voiceBus } from '../../voice/voiceBus';
import { voiceOrchestrator } from '../../voice/tts/orchestrator';
import { FEATURES } from '../../config/featureFlags';
import { passGate } from '../listening/gate';
import { debugBus } from '../../dev/debugBus';
import { beat } from '../../dev/health/monitor';
import { respond as callResponderService } from '../../services/responder';

// Intent routing functions
function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `The current time is ${displayHours}:${displayMinutes} ${ampm}`;
}

function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const dateString = now.toLocaleDateString('en-US', options);
  
  return `Today is ${dateString}`;
}

function getIdentity(): string {
  const responses = [
    "I'm Chango, your AI assistant. I'm here to help you with various tasks and answer your questions.",
    "I'm Chango, an AI voice assistant designed to make your interactions more natural and helpful.",
    "My name is Chango. I'm an artificial intelligence assistant ready to help you.",
    "I'm Chango, your personal AI companion. How can I assist you today?"
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function getMoodResponse(): string {
  const responses = [
    "I'm functioning optimally and ready to assist you!",
    "I'm doing great! Thanks for asking. How can I help you today?",
    "All systems are operational and I'm feeling helpful!",
    "I'm excellent! Ready to tackle any questions or tasks you have.",
    "I'm running smoothly and excited to help you!"
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Small-talk responses
function getSmallTalkResponse(text: string): string | null {
  const lowercaseText = text.toLowerCase();
  
  // Greetings
  if (lowercaseText.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/)) {
    const greetings = [
      "Hello! How can I assist you today?",
      "Hi there! What can I help you with?",
      "Greetings! I'm here to help.",
      "Hello! Nice to hear from you."
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // Thanks
  if (lowercaseText.match(/thank|thanks|appreciate/)) {
    const thanks = [
      "You're welcome! Happy to help.",
      "My pleasure! Is there anything else you need?",
      "Glad I could assist!",
      "You're very welcome!"
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }
  
  // Goodbye
  if (lowercaseText.match(/bye|goodbye|see you|farewell|talk to you later/)) {
    const goodbyes = [
      "Goodbye! Have a great day!",
      "See you later! Take care.",
      "Farewell! I'll be here when you need me.",
      "Bye! Feel free to come back anytime."
    ];
    return goodbyes[Math.floor(Math.random() * goodbyes.length)];
  }
  
  // Help
  if (lowercaseText.match(/^(help|what can you do|capabilities|commands)/)) {
    return "I can help you with various tasks! Try asking me about the time, date, or just have a conversation with me. I'm here to assist!";
  }
  
  return null;
}

// Check if text is a question
function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  // Check for question mark or question words
  return trimmed.endsWith('?') || 
         trimmed.toLowerCase().match(/^(what|when|where|who|why|how|is|are|can|could|would|should|do|does|did)/i) !== null;
}

// Main routing function
export function route(text: string): string | null {
  const lowercaseText = text.toLowerCase();
  
  console.log('[ConversationEngine] 🔍 Routing text:', text);
  console.log('[ConversationEngine] 🔍 Lowercase text:', lowercaseText);
  
  // If AnswerOnlyWhenAsked is enabled, only respond to questions
  if (FEATURES.ANSWER_ONLY_WHEN_ASKED && !isQuestion(text)) {
    console.log('[ConversationEngine] Not a question, skipping response (AnswerOnlyWhenAsked enabled)');
    return null;
  }
  
  // Check for time intent
  if (lowercaseText.match(/what.*time|current time|time is it|tell.*time/)) {
    console.log('[ConversationEngine] ⏰ Matched TIME intent');
    return getCurrentTime();
  }
  
  // Check for date intent - Updated to handle "what is today", "what's today", etc.
  if (lowercaseText.match(/what.*today|what.*date|what's today|today's date|current date|today.*date|what day|which day/)) {
    console.log('[ConversationEngine] 📅 Matched DATE intent');
    return getCurrentDate();
  }
  
  // Check for identity intent
  if (lowercaseText.match(/who are you|what are you|your name|tell me about yourself/)) {
    console.log('[ConversationEngine] 🤖 Matched IDENTITY intent');
    return getIdentity();
  }
  
  // Check for mood intent
  if (lowercaseText.match(/how are you|how.*feeling|how.*doing|what.*mood/)) {
    console.log('[ConversationEngine] 😊 Matched MOOD intent');
    return getMoodResponse();
  }
  
  // Check for small talk
  const smallTalkResponse = getSmallTalkResponse(text);
  if (smallTalkResponse) {
    console.log('[ConversationEngine] 💬 Matched SMALL TALK intent');
    return smallTalkResponse;
  }
  
  // Weather intent (placeholder - would need actual API integration)
  if (lowercaseText.match(/weather|temperature|forecast|rain|sunny|cloudy/)) {
    console.log('[ConversationEngine] ☁️ Matched WEATHER intent');
    return "I'd need access to weather services to provide current weather information. For now, I suggest checking your favorite weather app or website.";
  }
  
  // Math operations (simple examples)
  if (lowercaseText.match(/what is \d+ (plus|minus|times|divided by) \d+/)) {
    console.log('[ConversationEngine] 🔢 Matched MATH intent');
    try {
      const match = lowercaseText.match(/what is (\d+) (plus|minus|times|divided by) (\d+)/);
      if (match) {
        const num1 = parseInt(match[1]);
        const operation = match[2];
        const num2 = parseInt(match[3]);
        
        let result: number;
        switch (operation) {
          case 'plus':
            result = num1 + num2;
            break;
          case 'minus':
            result = num1 - num2;
            break;
          case 'times':
            result = num1 * num2;
            break;
          case 'divided by':
            result = num2 !== 0 ? num1 / num2 : 0;
            break;
          default:
            return null;
        }
        
        return `${num1} ${operation} ${num2} equals ${result}`;
      }
    } catch (error) {
      console.error('Math parsing error:', error);
    }
  }
  
  // Default response for unrecognized intents
  console.log('[ConversationEngine] ❌ No intent matched for:', text);
  return null;
}

// Unified response function that sends response through both channels
async function respond(text: string, typed: boolean = false): Promise<void> {
  console.log('[ConversationEngine] 📥 respond() called with:', text, 'typed:', typed);
  
  try {
    console.log('[ConversationEngine] Getting response from responder service for:', text);
    
    // Use the responder service which will handle API calls to backend
    console.log('[ConversationEngine] Calling responder service...');
    const response = await callResponderService(text, {
      source: typed ? 'text' : 'voice',
      responseType: 'both',  // Get both text and voice responses
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
    
    if (response) {
      console.log('[ConversationEngine] ✅ Got response from responder:', response);
      
      // Emit response event for UI components to listen to
      console.log('[ConversationEngine] 🚀 Emitting changoResponse event');
      voiceBus.emit({
        type: 'changoResponse',
        text: response,
        source: 'conversation'
      });
      console.log('[ConversationEngine] ✅ changoResponse event emitted');
      
      // Log TTS speak to debug bus
      if (FEATURES.DEBUG_BUS) {
        debugBus.info('TTS', 'speak', { text: response });
      }
      
      // Send TTS heartbeat
      try {
        beat('tts', { speaking: true, text: response });
      } catch (error) {
        console.error('[ConversationEngine] Error sending TTS heartbeat:', error);
      }
      
      // Note: responder service already handles speaking through voice events
      // But we'll also ensure it's spoken here for redundancy
      voiceOrchestrator.speak(response);
      console.log('[ConversationEngine] Response sent to voice orchestrator');
    } else {
      console.log('[ConversationEngine] ⚠️ No response from responder service');
      const fallbackResponse = "I'm having trouble processing that. Please try again.";
      
      // Emit response event for UI components
      console.log('[ConversationEngine] 🚀 Emitting fallback changoResponse event');
      voiceBus.emit({
        type: 'changoResponse',
        text: fallbackResponse,
        source: 'conversation'
      });
      
      voiceOrchestrator.speak(fallbackResponse);
      console.log('[ConversationEngine] Fallback response sent');
    }
  } catch (error) {
    console.error('[ConversationEngine] ❌ Error getting response:', error);
    const errorResponse = "Sorry, I encountered an error. Please try again.";
    
    // Emit error response event
    console.log('[ConversationEngine] 🚀 Emitting error changoResponse event');
    voiceBus.emit({
      type: 'changoResponse',
      text: errorResponse,
      source: 'conversation'
    });
    
    voiceOrchestrator.speak(errorResponse);
  }
  
  console.log('[ConversationEngine] ✅ respond() function completed');
}

// Unified handle function that processes both typed and speech input
async function handle(raw: string, typed: boolean = false): Promise<void> {
  const inputType = typed ? 'typed' : 'speech';
  console.log(`[ConversationEngine] 📢 Processing ${inputType} input:`, raw);
  
  // Send STT heartbeat for speech input
  if (!typed) {
    try {
      beat('stt', { processing: true, text: raw });
    } catch (error) {
      console.error('[ConversationEngine] Error sending STT heartbeat:', error);
    }
  }
  
  // Apply gate filtering
  const gateResult = passGate(raw, typed);
  console.log(`[ConversationEngine] Gate result for ${inputType} input:`, {
    allowed: gateResult.allowed,
    reason: gateResult.reason,
    originalText: raw,
    processedText: gateResult.text
  });
  
  // Log gate decision to debug bus
  if (FEATURES.DEBUG_BUS) {
    if (gateResult.allowed) {
      debugBus.info('Gate', 'pass', { 
        text: gateResult.text, 
        reason: gateResult.reason,
        typed 
      });
      console.log(`[ConversationEngine] ✅ Gate PASSED - reason: ${gateResult.reason}, text: "${gateResult.text}"`);
      
      // Send gate heartbeat
      try {
        beat('gate', { passed: true, text: gateResult.text, reason: gateResult.reason });
      } catch (error) {
        console.error('[ConversationEngine] Error sending gate heartbeat:', error);
      }
    } else {
      // Log gate block event
      debugBus.info('Gate', 'block', { 
        text: raw, 
        reason: gateResult.reason,
        typed 
      });
      console.log(`[ConversationEngine] 🚫 Gate BLOCKED - reason: ${gateResult.reason}, text: "${raw}"`);
      
      // Send gate heartbeat for blocked events too
      try {
        beat('gate', { passed: false, text: raw, reason: gateResult.reason });
      } catch (error) {
        console.error('[ConversationEngine] Error sending gate heartbeat:', error);
      }
    }
  }
  
  // If not allowed through gate, don't process further
  if (!gateResult.allowed) {
    console.log(`[ConversationEngine] 🚫 ${inputType} blocked by gate:`, gateResult.reason);
    return;
  }
  
  // Handle "ping" reason specially - user just said the wake word alone
  if (gateResult.reason === "ping") {
    console.log('[ConversationEngine] 🔔 Wake word PING detected - responding with acknowledgment');
    const ackResponse = "Yes?";
    
    // Emit response event for UI components
    voiceBus.emit({
      type: 'changoResponse',
      text: ackResponse,
      source: 'conversation'
    });
    
    // Speak the acknowledgment
    voiceOrchestrator.speak(ackResponse);
    console.log('[ConversationEngine] Acknowledgment sent: "Yes?"');
    return;
  }
  
  // Use the processed text from the gate (with wake word stripped for speech)
  const processedText = gateResult.text;
  console.log('[ConversationEngine] Gate allowed, processing:', processedText);
  
  // Generate and send response - pass typed parameter
  await respond(processedText, typed);
}

// Initialize conversation engine with event listeners
export function initConversationEngine(): void {
  console.log('[ConversationEngine] 🚀 Initializing conversation engine...');
  console.log('[ConversationEngine] Timestamp:', new Date().toISOString());
  
  // First, set up event listeners
  console.log('[ConversationEngine] Setting up event listeners...');
  
  // Listen for user speech recognized events
  const unsubscribeSpeech = voiceBus.on('userSpeechRecognized', (event) => {
    console.log('[ConversationEngine] 🎯 RECEIVED userSpeechRecognized event!');
    console.log('[ConversationEngine] Event details:', JSON.stringify(event));
    
    if (event.text) {
      console.log('[ConversationEngine] Processing speech input:', event.text);
      // Use unified handle function for speech input (typed=false)
      handle(event.text, false);
    } else {
      console.log('[ConversationEngine] ❌ Received speech event without text!', event);
    }
  });
  
  // Listen for user text submitted events  
  const unsubscribeText = voiceBus.on('userTextSubmitted', (event) => {
    console.log('[ConversationEngine] 🎯 RECEIVED userTextSubmitted event!');
    console.log('[ConversationEngine] Event details:', JSON.stringify(event));
    
    if (event.text) {
      console.log('[ConversationEngine] Processing typed input:', event.text);
      // Use unified handle function for typed input (typed=true)
      handle(event.text, true);
    } else {
      console.log('[ConversationEngine] ❌ Received text event without text!', event);
    }
  });
  
  // Listen for cancel events
  const unsubscribeCancel = voiceBus.on('cancel', (event) => {
    console.log('[ConversationEngine] Speech cancelled by:', event.source);
  });
  
  // Listen for mute changes
  const unsubscribeMute = voiceBus.on('muteChange', (event) => {
    console.log('[ConversationEngine] Mute state changed to:', event.muted);
  });
  
  console.log('[ConversationEngine] ✅ Event listeners registered successfully');
  console.log('[ConversationEngine] Registered listeners:', {
    userSpeechRecognized: !!unsubscribeSpeech,
    userTextSubmitted: !!unsubscribeText,
    cancel: !!unsubscribeCancel,
    muteChange: !!unsubscribeMute
  });
  
  // Expose functions to window for testing in dev mode
  if (import.meta.env.DEV) {
    const engineAPI = {
      route,
      getCurrentTime,
      getCurrentDate,
      getIdentity,
      getMoodResponse,
      getSmallTalkResponse,
      handle,
      respond,
      // Add test function to verify engine is working
      test: async () => {
        console.log('[ConversationEngine] Running test...');
        const testResult = await handle('lolo what time is it', true);
        console.log('[ConversationEngine] Test complete');
        return testResult;
      },
      // Add function to check listeners
      checkListeners: () => {
        const listeners = {
          userSpeechRecognized: !!unsubscribeSpeech,
          userTextSubmitted: !!unsubscribeText,
          cancel: !!unsubscribeCancel,
          muteChange: !!unsubscribeMute
        };
        console.log('[ConversationEngine] Current listeners:', listeners);
        return listeners;
      }
    };
    
    (window as any).conversationEngine = engineAPI;
    console.log('[ConversationEngine] ✅ Exposed to window.conversationEngine for testing');
    console.log('[ConversationEngine] Available functions:', Object.keys(engineAPI));
  }
  
  console.log('[ConversationEngine] ✅ Initialization complete!');
  console.log('[ConversationEngine] Ready to process user input via text or speech');
  console.log('[ConversationEngine] Wake word required for speech input: "lolo"');
}

// Export for testing individual functions
export {
  getCurrentTime,
  getCurrentDate,
  getIdentity,
  getMoodResponse,
  getSmallTalkResponse
};