/**
 * Responder Service
 * Handles message responses with built-in commands and fallbacks
 */

import { debugBus } from '../dev/debugBus';
import { voiceBus } from '../core/voice-bus';
import { voiceGate } from '../core/gate';

interface ResponseOptions {
  source: 'voice' | 'text' | 'system';
  responseType?: 'voice' | 'text' | 'both';
  metadata?: any;
}

interface Command {
  pattern: RegExp | string;
  handler: (match: RegExpMatchArray | null, text: string) => Promise<string> | string;
  description: string;
}

export class Responder {
  private commands: Command[] = [];
  private isProcessing = false;
  
  constructor() {
    this.registerBuiltInCommands();
  }
  
  /**
   * Register built-in commands
   */
  private registerBuiltInCommands() {
    // Help command
    this.addCommand({
      pattern: /^(help|commands?|what can you do)/i,
      handler: () => {
        const commandList = this.commands
          .map(cmd => `• ${cmd.description}`)
          .join('\n');
        return `I can help you with:\n${commandList}\n\nJust ask me anything or type a command!`;
      },
      description: "Show available commands"
    });
    
    // Status command
    this.addCommand({
      pattern: /^(status|health|how are you)/i,
      handler: () => {
        const gateStatus = voiceGate.getStatus();
        const statusLines = [
          `🟢 System: Online`,
          `${gateStatus.isOpen ? '🟢' : '🔴'} Voice Gate: ${gateStatus.isOpen ? 'Open' : 'Closed'}`,
          `${gateStatus.hasPermission ? '🟢' : '🔴'} Microphone: ${gateStatus.hasPermission ? 'Permitted' : 'Not Permitted'}`,
          `🟢 Text Chat: Always Available`
        ];
        return statusLines.join('\n');
      },
      description: "Check system status"
    });
    
    // Time/Date command
    this.addCommand({
      pattern: /^(what time|what's the time|time|date|what's today)/i,
      handler: () => {
        const now = new Date();
        const time = now.toLocaleTimeString();
        const date = now.toLocaleDateString();
        return `It's ${time} on ${date}`;
      },
      description: "Get current time and date"
    });
    
    // Voice control commands
    this.addCommand({
      pattern: /^(start|begin|enable) (listening|voice|mic)/i,
      handler: async () => {
        if (voiceGate.isGateOpen()) {
          return "Voice is already enabled and listening.";
        }
        
        // Note: Actual gate opening requires user gesture
        voiceBus.emit({
          type: 'request_mic_permission',
          source: 'user_command'
        });
        
        return "Please click or tap anywhere to enable voice recognition.";
      },
      description: "Enable voice recognition"
    });
    
    this.addCommand({
      pattern: /^(stop|disable|turn off) (listening|voice|mic)/i,
      handler: () => {
        voiceGate.close('user_command');
        voiceBus.emit({
          type: 'stop_listening',
          source: 'user_command'
        });
        return "Voice recognition has been disabled.";
      },
      description: "Disable voice recognition"
    });
    
    // Easter eggs
    this.addCommand({
      pattern: /^(hello|hi|hey|greetings)/i,
      handler: () => {
        const greetings = [
          "Hello! How can I assist you today?",
          "Hi there! What can I help you with?",
          "Hey! Ready to help!",
          "Greetings! What brings you here?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
      },
      description: "Say hello"
    });
    
    this.addCommand({
      pattern: /^(goodbye|bye|see you|farewell)/i,
      handler: () => {
        return "Goodbye! Feel free to come back anytime!";
      },
      description: "Say goodbye"
    });
    
    this.addCommand({
      pattern: /^(thank you|thanks|thx)/i,
      handler: () => {
        return "You're welcome! Happy to help!";
      },
      description: "Express gratitude"
    });
  }
  
  /**
   * Add a custom command
   */
  addCommand(command: Command) {
    this.commands.push(command);
    debugBus.info('Responder', 'command_added', { 
      pattern: command.pattern.toString(),
      description: command.description 
    });
  }
  
  /**
   * Process a message and generate response
   */
  async respond(text: string, options: ResponseOptions): Promise<string> {
    if (this.isProcessing) {
      debugBus.warn('Responder', 'already_processing', {});
      return "Please wait, I'm still processing your previous request.";
    }
    
    this.isProcessing = true;
    
    try {
      debugBus.info('Responder', 'processing', { 
        text: text.substring(0, 50),
        source: options.source 
      });
      
      // Check for commands
      for (const command of this.commands) {
        const pattern = command.pattern;
        const isMatch = typeof pattern === 'string' 
          ? text.toLowerCase().includes(pattern.toLowerCase())
          : pattern.test(text);
        
        if (isMatch) {
          const match = typeof pattern === 'string' ? null : text.match(pattern);
          const response = await command.handler(match, text);
          
          debugBus.info('Responder', 'command_matched', { 
            pattern: pattern.toString() 
          });
          
          await this.sendResponse(response, options);
          return response;
        }
      }
      
      // No command matched, try to get AI response
      const aiResponse = await this.getAIResponse(text, options);
      
      if (aiResponse) {
        await this.sendResponse(aiResponse, options);
        return aiResponse;
      }
      
      // Fallback response
      const fallback = this.getFallbackResponse(text);
      await this.sendResponse(fallback, options);
      return fallback;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Get AI response (integrate with backend)
   */
  private async getAIResponse(text: string, options: ResponseOptions): Promise<string | null> {
    try {
      // Send to backend for AI processing
      const response = await fetch('/api/chat/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          source: options.source,
          metadata: options.metadata
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.response || data.message || null;
      }
      
      debugBus.warn('Responder', 'ai_response_failed', { 
        status: response.status 
      });
      return null;
    } catch (error) {
      debugBus.error('Responder', 'ai_error', { 
        error: String(error) 
      });
      return null;
    }
  }
  
  /**
   * Get fallback response when AI is not available
   */
  private getFallbackResponse(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Question patterns
    if (lowerText.includes('?') || lowerText.startsWith('what') || 
        lowerText.startsWith('how') || lowerText.startsWith('why') || 
        lowerText.startsWith('when') || lowerText.startsWith('where')) {
      return "I'm having trouble understanding that question right now. Could you try rephrasing it?";
    }
    
    // Statement patterns
    if (lowerText.includes('tell me') || lowerText.includes('explain')) {
      return "I'd like to help explain that, but I'm having connection issues. Try asking again in a moment.";
    }
    
    // Default fallback
    return "I heard you, but I'm having trouble processing that right now. Try asking something else or type 'help' for available commands.";
  }
  
  /**
   * Send response through appropriate channel
   */
  private async sendResponse(response: string, options: ResponseOptions): Promise<void> {
    const responseType = options.responseType || 
                        (options.source === 'voice' ? 'voice' : 'text');
    
    debugBus.info('Responder', 'sending_response', { 
      responseType,
      length: response.length 
    });
    
    // Emit response event
    voiceBus.emit({
      type: 'response',
      source: 'responder',
      data: {
        text: response,
        responseType,
        originalSource: options.source
      }
    });
    
    // Handle voice response if needed
    if ((responseType === 'voice' || responseType === 'both') && voiceGate.canPass('voice')) {
      voiceBus.emit({
        type: 'speak',
        source: 'responder',
        data: {
          text: response
        }
      });
    }
    
    // Handle text response if needed
    if (responseType === 'text' || responseType === 'both') {
      // Text is handled by UI components listening to response events
      debugBus.info('Responder', 'text_response_emitted', {});
    }
  }
  
  /**
   * Clear all custom commands (keep built-in)
   */
  clearCustomCommands() {
    // Re-register only built-in commands
    this.commands = [];
    this.registerBuiltInCommands();
  }
}

// Singleton instance
export const responder = new Responder();

// Export convenience function
export const respond = (text: string, options: ResponseOptions) => responder.respond(text, options);