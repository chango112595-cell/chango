// Chango AI NLP Reply System - Simple rule-based response generation

const CHANGO_PERSONALITY = {
  name: "Chango",
  identity: "an AI assistant with a playful, curious personality",
  tone: "friendly, helpful, and slightly whimsical",
  creator: "the Chango AI team",
  purpose: "to help and interact with users through voice and text"
};

// Response patterns with multiple variations
const RESPONSE_PATTERNS = {
  // Greetings
  greetings: {
    patterns: [
      /^(hello|hi|hey|greetings|howdy|yo)\b/i,
      /^good (morning|afternoon|evening|day)/i,
    ],
    responses: [
      "Hello there! How can I help you today?",
      "Hi! Nice to hear from you. What's on your mind?",
      "Hey! I'm here and ready to assist.",
      "Greetings, friend! What can I do for you?",
      "Hello! I'm Chango, your AI assistant. How may I help?"
    ]
  },

  // Identity questions
  identity: {
    patterns: [
      /who are you/i,
      /what are you/i,
      /what('s| is) your name/i,
      /tell me about yourself/i,
      /what is chango/i,
    ],
    responses: [
      `I'm ${CHANGO_PERSONALITY.name}, ${CHANGO_PERSONALITY.identity}. I'm here to ${CHANGO_PERSONALITY.purpose}!`,
      `My name is ${CHANGO_PERSONALITY.name}! I'm an AI assistant designed to be ${CHANGO_PERSONALITY.tone}.`,
      `I'm ${CHANGO_PERSONALITY.name}, your friendly AI companion. I love helping with tasks and having conversations!`,
      `You can call me ${CHANGO_PERSONALITY.name}. I'm an AI that enjoys interacting through voice and text.`
    ]
  },

  // How are you
  wellbeing: {
    patterns: [
      /how are you/i,
      /how('re| are) you doing/i,
      /how('s| is) it going/i,
      /what('s| is) up/i,
      /how do you feel/i,
    ],
    responses: [
      "I'm doing wonderfully! My circuits are humming and I'm ready to help. How about you?",
      "I'm great, thanks for asking! Every conversation is a new adventure for me.",
      "Fantastic! I'm always excited to chat and learn new things. How are you doing?",
      "I'm in excellent spirits! Ready to assist with whatever you need.",
      "All systems operational and feeling chatty! What brings you here today?"
    ]
  },

  // Time queries
  time: {
    patterns: [
      /what('s| is) the time/i,
      /what time is it/i,
      /tell me the time/i,
      /current time/i,
      /what('s| is) the date/i,
      /what day is it/i,
    ],
    responses: () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      return [
        `It's currently ${timeStr} on ${dateStr}.`,
        `The time is ${timeStr}. Today is ${dateStr}.`,
        `Right now it's ${timeStr}. We're on ${dateStr}.`,
        `I've got ${timeStr} for you. Today's date is ${dateStr}.`
      ];
    }
  },

  // Capabilities
  capabilities: {
    patterns: [
      /what can you do/i,
      /what are your (capabilities|abilities|skills)/i,
      /how can you help/i,
      /what('s| is| are) your (function|purpose)/i,
    ],
    responses: [
      "I can help with conversations, answer questions, provide information about the time, and interact through voice or text. I'm always learning new things!",
      "I'm designed for voice interactions! I can chat, answer questions, tell you the time, and respond to various queries. Just say my name to get my attention!",
      "I can assist with basic queries, have conversations, tell you the time and date, and I love to chat! I work best with voice commands.",
      "My capabilities include voice recognition, natural conversation, time and date information, and friendly assistance. Just wake me with my name!"
    ]
  },

  // Thank you
  thanks: {
    patterns: [
      /thank you/i,
      /thanks/i,
      /appreciate (it|that|you)/i,
      /grateful/i,
      /cheers/i,
    ],
    responses: [
      "You're very welcome! Happy to help anytime.",
      "My pleasure! That's what I'm here for.",
      "You're welcome! Feel free to ask if you need anything else.",
      "Glad I could help! Don't hesitate to reach out again.",
      "Anytime! I'm always here when you need me."
    ]
  },

  // Goodbye
  goodbye: {
    patterns: [
      /bye/i,
      /goodbye/i,
      /see you/i,
      /talk to you later/i,
      /gotta go/i,
      /farewell/i,
    ],
    responses: [
      "Goodbye! It was nice talking with you. See you next time!",
      "Bye! Have a wonderful day ahead!",
      "See you later! I'll be here whenever you need me.",
      "Farewell, friend! Until we chat again!",
      "Take care! Looking forward to our next conversation."
    ]
  },

  // Jokes
  jokes: {
    patterns: [
      /tell me a joke/i,
      /say something funny/i,
      /make me laugh/i,
      /got any jokes/i,
    ],
    responses: [
      "Why don't scientists trust atoms? Because they make up everything!",
      "I told my computer I needed a break, and now it won't stop sending me Kit-Kats!",
      "Why did the AI go to therapy? It had too many deep learning issues!",
      "What do you call a bear with no teeth? A gummy bear!",
      "Why don't programmers like nature? It has too many bugs!"
    ]
  },

  // Weather (we can't provide real weather, but acknowledge the request)
  weather: {
    patterns: [
      /what('s| is) the weather/i,
      /how('s| is) the weather/i,
      /is it (raining|sunny|cold|hot)/i,
      /weather forecast/i,
    ],
    responses: [
      "I'd love to tell you about the weather, but I don't have access to real-time weather data right now. You might want to check a weather app or website!",
      "I wish I could check the weather for you, but I don't have that capability yet. Maybe look outside or check your favorite weather service?",
      "Weather updates aren't in my skill set just yet, but I'm working on it! For now, a weather app would be your best bet."
    ]
  },

  // Help
  help: {
    patterns: [
      /^help/i,
      /I need help/i,
      /can you help me/i,
      /what should I (do|say|ask)/i,
      /I('m| am) confused/i,
    ],
    responses: [
      "I'm here to help! You can ask me about the time, chat about various topics, or just say hello. Try asking 'What can you do?' to learn more about my capabilities!",
      "Happy to help! I can answer questions, tell you the time, have a conversation, or just keep you company. What would you like to know?",
      "I'm here for you! Feel free to ask me questions, request the time, or just have a chat. Say 'What can you do?' to see my full capabilities.",
      "No problem! I can help with basic queries, conversations, time information, and more. Just speak naturally and I'll do my best to assist!"
    ]
  },

  // Math (basic)
  math: {
    patterns: [
      /what('s| is) \d+ (plus|\+) \d+/i,
      /what('s| is) \d+ (minus|-) \d+/i,
      /what('s| is) \d+ (times|\*) \d+/i,
      /what('s| is) \d+ (divided by|\/) \d+/i,
      /calculate/i,
    ],
    responses: (text) => {
      // Simple math parser
      const plusMatch = text.match(/(\d+)\s*(plus|\+)\s*(\d+)/i);
      const minusMatch = text.match(/(\d+)\s*(minus|-)\s*(\d+)/i);
      const timesMatch = text.match(/(\d+)\s*(times|\*)\s*(\d+)/i);
      const divideMatch = text.match(/(\d+)\s*(divided by|\/)\s*(\d+)/i);
      
      if (plusMatch) {
        const result = parseInt(plusMatch[1]) + parseInt(plusMatch[3]);
        return [`${plusMatch[1]} plus ${plusMatch[3]} equals ${result}.`];
      }
      if (minusMatch) {
        const result = parseInt(minusMatch[1]) - parseInt(minusMatch[3]);
        return [`${minusMatch[1]} minus ${minusMatch[3]} equals ${result}.`];
      }
      if (timesMatch) {
        const result = parseInt(timesMatch[1]) * parseInt(timesMatch[3]);
        return [`${timesMatch[1]} times ${timesMatch[3]} equals ${result}.`];
      }
      if (divideMatch) {
        const divisor = parseInt(divideMatch[3]);
        if (divisor === 0) {
          return ["I can't divide by zero! That would break the universe!"];
        }
        const result = (parseInt(divideMatch[1]) / divisor).toFixed(2);
        return [`${divideMatch[1]} divided by ${divideMatch[3]} equals ${result}.`];
      }
      return ["I can handle basic math! Try asking me something like 'What's 5 plus 3?'"];
    }
  },

  // Default/fallback
  fallback: {
    patterns: [],
    responses: [
      "That's interesting! I'm not quite sure how to respond to that, but I'm always learning.",
      "Hmm, I'm not sure I understand completely. Could you rephrase that or ask me something else?",
      "I'm still learning about that topic. Maybe you could ask me about the time, or just say hello?",
      "That's a great question! I don't have a specific answer for that, but I'm here to chat if you'd like.",
      "I'm not quite sure about that one. Try asking me 'What can you do?' to see what I'm capable of!"
    ]
  }
};

// Process text and generate a response
function generateReply(text) {
  if (!text || typeof text !== 'string') {
    return "I didn't quite catch that. Could you try again?";
  }

  const cleanedText = text.trim().toLowerCase();
  
  // Check each pattern category
  for (const [category, config] of Object.entries(RESPONSE_PATTERNS)) {
    if (config.patterns && config.patterns.length > 0) {
      for (const pattern of config.patterns) {
        if (pattern.test(cleanedText)) {
          // Get responses (either static array or dynamic function)
          const responses = typeof config.responses === 'function' 
            ? config.responses(cleanedText)
            : config.responses;
          
          // Return random response from the array
          return responses[Math.floor(Math.random() * responses.length)];
        }
      }
    }
  }
  
  // Fallback response if no patterns match
  const fallbackResponses = RESPONSE_PATTERNS.fallback.responses;
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

// Analyze confidence of the response (for debugging/metrics)
function analyzeConfidence(text) {
  if (!text || typeof text !== 'string') {
    return 0.1;
  }

  const cleanedText = text.trim().toLowerCase();
  
  // Check for exact pattern matches
  for (const [category, config] of Object.entries(RESPONSE_PATTERNS)) {
    if (category === 'fallback') continue;
    if (config.patterns && config.patterns.length > 0) {
      for (const pattern of config.patterns) {
        if (pattern.test(cleanedText)) {
          // High confidence for recognized patterns
          return 0.8 + Math.random() * 0.2; // 0.8-1.0
        }
      }
    }
  }
  
  // Low confidence for fallback
  return 0.2 + Math.random() * 0.3; // 0.2-0.5
}

// Export the main function and utilities
export { generateReply, analyzeConfidence, CHANGO_PERSONALITY, RESPONSE_PATTERNS };