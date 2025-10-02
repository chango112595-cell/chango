/**
 * Conversation Engine
 * Handles intent routing and text processing for voice interactions
 */

import { voiceBus } from '../../voice/voiceBus';
import { voiceOrchestrator } from '../../voice/tts/orchestrator';
import { FEATURES } from '../../config/featureFlags';
import { passGate } from '../listening/gate';

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

// Initialize conversation engine with event listeners
export function initConversationEngine(): void {
  console.log('[ConversationEngine] Initializing...');
  
  // Expose route function to window for testing in dev mode
  if (import.meta.env.DEV) {
    (window as any).conversationEngine = {
      route,
      getCurrentTime,
      getCurrentDate,
      getIdentity,
      getMoodResponse,
      getSmallTalkResponse
    };
    console.log('[ConversationEngine] Exposed to window.conversationEngine for testing');
  }
  
  // Listen for user speech recognized events
  voiceBus.on('userSpeechRecognized', (event) => {
    console.log('[ConversationEngine] 🎯 RECEIVED userSpeechRecognized event!', event);
    
    if (event.text) {
      console.log('[ConversationEngine] 📢 Received speech input:', event.text);
      console.log('[ConversationEngine] Processing speech-to-text result...');
      
      // Apply gate filtering for speech input (typed=false)
      const gateResult = passGate(event.text, false);
      console.log('[ConversationEngine] Gate result:', gateResult);
      
      if (!gateResult.allowed) {
        console.log('[ConversationEngine] 🚫 Speech blocked by gate:', gateResult.reason);
        return; // Don't process further
      }
      
      // Use the processed text from the gate (with wake word stripped)
      const processedText = gateResult.text;
      console.log('[ConversationEngine] Gate allowed, processing:', processedText);
      
      const response = route(processedText);
      if (response) {
        console.log('[ConversationEngine] ✅ Generated response:', response);
        
        // Emit response event for UI components to listen to
        voiceBus.emit({
          type: 'changoResponse',
          text: response,
          source: 'conversation'
        });
        
        // Use voiceOrchestrator to speak the response
        voiceOrchestrator.speak(response);
        console.log('[ConversationEngine] Response sent to voice orchestrator');
      } else {
        console.log('[ConversationEngine] ⚠️ No specific route matched, using default response');
        const defaultResponse = "I'm not sure how to respond to that. Could you please rephrase or ask something else?";
        
        // Emit response event for UI components
        voiceBus.emit({
          type: 'changoResponse',
          text: defaultResponse,
          source: 'conversation'
        });
        
        voiceOrchestrator.speak(defaultResponse);
        console.log('[ConversationEngine] Default response sent to voice orchestrator');
      }
    } else {
      console.log('[ConversationEngine] ❌ Received event without text!', event);
    }
  });
  
  // Listen for user text submitted events
  voiceBus.on('userTextSubmitted', (event) => {
    console.log('[ConversationEngine] 🎯 RECEIVED userTextSubmitted event!', event);
    if (event.text) {
      console.log('[ConversationEngine] 📢 Received text input:', event.text);
      console.log('[ConversationEngine] Processing text submission...');
      
      // Apply gate filtering for typed input (typed=true)
      const gateResult = passGate(event.text, true);
      console.log('[ConversationEngine] Gate result for typed input:', gateResult);
      
      if (!gateResult.allowed) {
        console.log('[ConversationEngine] 🚫 Text blocked by gate (unexpected):', gateResult.reason);
        return; // Don't process further (shouldn't happen for typed input)
      }
      
      // Use the processed text from the gate
      const processedText = gateResult.text;
      console.log('[ConversationEngine] Gate allowed typed input, processing:', processedText);
      
      const response = route(processedText);
      if (response) {
        console.log('[ConversationEngine] Generated response:', response);
        
        // Emit response event for UI components to listen to
        voiceBus.emit({
          type: 'changoResponse',
          text: response,
          source: 'conversation'
        });
        
        // Use voiceOrchestrator to speak the response
        voiceOrchestrator.speak(response);
        console.log('[ConversationEngine] Response sent to voice orchestrator');
      } else {
        console.log('[ConversationEngine] No specific route matched, using default response');
        const defaultResponse = "I'm not sure how to respond to that. Could you please rephrase or ask something else?";
        
        // Emit response event for UI components
        voiceBus.emit({
          type: 'changoResponse',
          text: defaultResponse,
          source: 'conversation'
        });
        
        voiceOrchestrator.speak(defaultResponse);
        console.log('[ConversationEngine] Default response sent to voice orchestrator');
      }
    }
  });
  
  // Listen for cancel events
  voiceBus.on('cancel', (event) => {
    console.log('[ConversationEngine] Speech cancelled by:', event.source);
  });
  
  // Listen for mute changes
  voiceBus.on('muteChange', (event) => {
    console.log('[ConversationEngine] Mute state changed to:', event.muted);
  });
  
  console.log('[ConversationEngine] Initialization complete');
  console.log('[ConversationEngine] Ready to process user input via text or speech');
}

// Export for testing individual functions
export {
  getCurrentTime,
  getCurrentDate,
  getIdentity,
  getMoodResponse,
  getSmallTalkResponse
};