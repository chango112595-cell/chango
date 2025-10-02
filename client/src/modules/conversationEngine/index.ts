/**
 * Conversation Engine
 * Handles intent routing and text processing for voice interactions
 */

import { voiceBus } from '../../voice/voiceBus';

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

// Main routing function
export function route(text: string): string | null {
  const lowercaseText = text.toLowerCase();
  
  // Check for time intent
  if (lowercaseText.match(/what.*time|current time|time is it|tell.*time/)) {
    return getCurrentTime();
  }
  
  // Check for date intent
  if (lowercaseText.match(/what.*date|current date|today.*date|what day|which day/)) {
    return getCurrentDate();
  }
  
  // Check for identity intent
  if (lowercaseText.match(/who are you|what are you|your name|tell me about yourself/)) {
    return getIdentity();
  }
  
  // Check for mood intent
  if (lowercaseText.match(/how are you|how.*feeling|how.*doing|what.*mood/)) {
    return getMoodResponse();
  }
  
  // Check for small talk
  const smallTalkResponse = getSmallTalkResponse(text);
  if (smallTalkResponse) {
    return smallTalkResponse;
  }
  
  // Weather intent (placeholder - would need actual API integration)
  if (lowercaseText.match(/weather|temperature|forecast|rain|sunny|cloudy/)) {
    return "I'd need access to weather services to provide current weather information. For now, I suggest checking your favorite weather app or website.";
  }
  
  // Math operations (simple examples)
  if (lowercaseText.match(/what is \d+ (plus|minus|times|divided by) \d+/)) {
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
  return null;
}

// Initialize conversation engine with event listeners
export function initConversationEngine(): void {
  console.log('Initializing Conversation Engine...');
  
  // Listen for user speech recognized events
  voiceBus.on('userSpeechRecognized', (event) => {
    if (event.text) {
      console.log('Processing speech:', event.text);
      
      const response = route(event.text);
      if (response) {
        // Emit speak event with the response
        voiceBus.emitSpeak(response, 'conversation');
      } else {
        // If no local response, could forward to backend or provide default
        voiceBus.emitSpeak(
          "I'm not sure how to respond to that. Could you please rephrase or ask something else?",
          'conversation'
        );
      }
    }
  });
  
  // Listen for user text submitted events
  voiceBus.on('userTextSubmitted', (event) => {
    if (event.text) {
      console.log('Processing text:', event.text);
      
      const response = route(event.text);
      if (response) {
        // Emit speak event with the response
        voiceBus.emitSpeak(response, 'conversation');
      } else {
        // If no local response, could forward to backend or provide default
        voiceBus.emitSpeak(
          "I'm not sure how to respond to that. Could you please rephrase or ask something else?",
          'conversation'
        );
      }
    }
  });
  
  // Listen for cancel events
  voiceBus.on('cancel', (event) => {
    console.log('Speech cancelled:', event.source);
  });
  
  // Listen for mute changes
  voiceBus.on('muteChange', (event) => {
    console.log('Mute state changed:', event.muted);
  });
  
  console.log('Conversation Engine initialized');
}

// Export for testing individual functions
export {
  getCurrentTime,
  getCurrentDate,
  getIdentity,
  getMoodResponse,
  getSmallTalkResponse
};