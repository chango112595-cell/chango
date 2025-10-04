/**
 * Simplified Responder Service
 * Handles basic message responses with local patterns and optional API fallback
 */

import { debugBus } from '../dev/debugBus';
import { voiceBus } from '../voice/voiceBus';
import { voiceOrchestrator } from '../voice/tts/orchestrator';

export interface ResponseOptions {
  source: 'voice' | 'text' | 'system';
  responseType?: 'voice' | 'text' | 'both';
  metadata?: Record<string, any>;
}

/**
 * Get a simple response for the given text input
 */
export async function getResponse(text: string): Promise<string> {
  try {
    // Simple local responses
    const lowerText = text.toLowerCase();
    
    // Greetings
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText === 'hey') {
      return "Hello! I'm Chango, your AI assistant. How can I help you today?";
    }
    
    // Time
    if (lowerText.includes('time') && lowerText.includes('what')) {
      const now = new Date();
      return `The current time is ${now.toLocaleTimeString()}.`;
    }
    
    // Date
    if (lowerText.includes('date') || lowerText.includes('today')) {
      const now = new Date();
      return `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }
    
    // Joke
    if (lowerText.includes('joke')) {
      const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call a fake noodle? An impasta!",
        "Why did the scarecrow win an award? He was outstanding in his field!",
        "What do you call a bear with no teeth? A gummy bear!",
        "Why did the math book look so sad? Because it had too many problems!"
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }
    
    // Identity
    if (lowerText.includes('who are you') || lowerText.includes('your name')) {
      return "I'm Chango, your AI assistant. I'm here to help you with various tasks and answer your questions!";
    }
    
    // How are you
    if (lowerText.includes('how are you')) {
      const responses = [
        "I'm functioning optimally and ready to assist you!",
        "I'm doing great! Thanks for asking. How can I help you?",
        "All systems operational! What can I do for you today?"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Thank you
    if (lowerText.includes('thank')) {
      return "You're welcome! Happy to help!";
    }
    
    // Goodbye
    if (lowerText.includes('bye') || lowerText.includes('goodbye')) {
      return "Goodbye! Have a great day!";
    }
    
    // Help
    if (lowerText.includes('help') || lowerText === 'what can you do') {
      return "I can help you with various tasks! Try asking me about the time, date, or just have a conversation with me. I'm here to assist!";
    }
    
    // Weather (placeholder)
    if (lowerText.includes('weather')) {
      return "I'd need access to weather services to provide current weather information. For now, I suggest checking your favorite weather app or website.";
    }
    
    // Try API endpoint if available for more complex queries
    try {
      const response = await fetch('/api/nlp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.reply || "I understand. How can I help you with that?";
      }
    } catch (apiError) {
      console.log('[Responder] API not available, using local response');
    }
    
    // Default responses based on question type
    if (text.includes('?')) {
      return "That's an interesting question! Let me think... I'm still learning, but I'll do my best to help.";
    }
    
    // Default response
    return "I understand. How can I help you with that?";
    
  } catch (error) {
    debugBus.error('Responder', 'get_response_error', { error: String(error) });
    return "I'm having trouble processing that. Could you try again?";
  }
}

/**
 * Main responder function that handles both getting response and logging
 */
export async function respond(text: string, options: ResponseOptions): Promise<string> {
  console.log('[Responder] 📥 CALLED with text:', text);
  console.log('[Responder] 📥 Options:', options);
  
  debugBus.info('Responder', 'processing', { 
    text: text.substring(0, 50),
    source: options.source 
  });
  
  const response = await getResponse(text);
  console.log('[Responder] 📤 Generated response:', response);
  
  debugBus.info('Responder', 'response_generated', { 
    length: response.length,
    responseType: options.responseType 
  });
  
  // NOTE: changoResponse event is emitted by the conversation engine, not here
  // This avoids duplicate events
  console.log('[Responder] ✅ Response generated (changoResponse will be emitted by conversation engine)');
  
  // Speak the response if responseType includes voice
  if (options.responseType === 'voice' || options.responseType === 'both') {
    try {
      console.log('[Responder] Triggering TTS for response:', response.substring(0, 50));
      await voiceOrchestrator.speak(response);
    } catch (error) {
      console.error('[Responder] Failed to speak response:', error);
      debugBus.error('Responder', 'tts_error', { error: String(error) });
    }
  }
  
  console.log('[Responder] ✅ Respond function completed');
  return response;
}

// Create responder object for compatibility with existing code
export const responder = {
  respond
};

// Export for testing
if (import.meta.env.DEV) {
  (window as any).responder = { getResponse, respond };
  console.log('[Responder] Exposed to window.responder for testing');
}