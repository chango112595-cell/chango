// Conversation Orchestrator - Centralized Q&A flow management
// Manages the single path for all Q&A interactions (typed or voice)

import { VoiceBus } from "@/lib/voiceBus";
import { Voice } from "@/lib/voiceController";

interface ConversationState {
  isBusy: boolean;
  lastUserInput: string;
  lastBotResponse: string;
  lastTimestamp: number;
  activeRequest: AbortController | null;
}

class ConversationOrchestratorClass {
  private state: ConversationState = {
    isBusy: false,
    lastUserInput: "",
    lastBotResponse: "",
    lastTimestamp: 0,
    activeRequest: null
  };

  private subscribers: Set<(state: ConversationState) => void> = new Set();

  // Subscribe to state changes
  subscribe(callback: (state: ConversationState) => void) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }

  // Get current state
  getState(): ConversationState {
    return { ...this.state };
  }

  // Check if busy
  isBusy(): boolean {
    return this.state.isBusy;
  }

  // Cancel any active request
  cancel() {
    if (this.state.activeRequest) {
      console.log("[ConversationOrchestrator] Cancelling active request");
      this.state.activeRequest.abort();
      this.state.activeRequest = null;
      this.state.isBusy = false;
      this.notify();
    }
  }

  // Main conversation handler - single path for all Q&A
  async processConversation(
    userInput: string,
    options: {
      addUserMessage?: (text: string) => void;
      addChangoMessage?: (text: string) => void;
      speak?: (text: string, force?: boolean) => void;
      showToast?: (title: string, description: string, variant?: string) => void;
      skipSpeech?: boolean; // For typed input that might not need speech
    } = {}
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    console.log("[ConversationOrchestrator] processConversation called with:", {
      userInput,
      hasOptions: !!options,
      hasAddUserMessage: !!options.addUserMessage,
      hasAddChangoMessage: !!options.addChangoMessage,
      hasSpeak: !!options.speak
    });
    
    // Prevent re-entrancy
    if (this.state.isBusy) {
      console.log("[ConversationOrchestrator] Busy - rejecting concurrent request");
      return { 
        success: false, 
        error: "Already processing a conversation. Please wait." 
      };
    }

    // Check power state
    const busState = VoiceBus.getState();
    console.log("[ConversationOrchestrator] VoiceBus state:", busState);
    if (!busState.power) {
      console.log("[ConversationOrchestrator] Power is off");
      return { 
        success: false, 
        error: "Voice system is powered off" 
      };
    }

    // Set busy flag
    this.state.isBusy = true;
    this.state.lastUserInput = userInput;
    this.state.lastTimestamp = Date.now();
    this.notify();

    try {
      // Add user message to conversation UI
      if (options.addUserMessage) {
        options.addUserMessage(userInput);
      }

      // Create abort controller for this request
      const abortController = new AbortController();
      this.state.activeRequest = abortController;

      // Send to NLP endpoint
      console.log("[ConversationOrchestrator] Sending to NLP:", userInput);
      const response = await fetch('/nlp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userInput }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`NLP request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("[ConversationOrchestrator] NLP response:", data);
      
      if (!data.ok || !data.reply) {
        throw new Error(data.error || 'Invalid NLP response');
      }

      // Store bot response
      this.state.lastBotResponse = data.reply;
      
      // Add Chango's response to conversation UI
      console.log("[ConversationOrchestrator] Adding Chango message to UI");
      if (options.addChangoMessage) {
        options.addChangoMessage(data.reply);
        console.log("[ConversationOrchestrator] Message added successfully");
      } else {
        console.warn("[ConversationOrchestrator] No addChangoMessage function provided!");
      }

      // Speak the response (unless explicitly skipped)
      if (!options.skipSpeech && options.speak) {
        // Check mute/power guards before speaking
        const currentBusState = VoiceBus.getState();
        const voiceMode = Voice.getMode();
        
        console.log("[ConversationOrchestrator] Checking speech guards:", {
          power: currentBusState.power,
          muted: currentBusState.mute,
          voiceMode
        });
        
        if (currentBusState.power && !currentBusState.mute && voiceMode !== 'KILLED') {
          console.log("[ConversationOrchestrator] Speaking response:", data.reply.slice(0, 50));
          // Force speak to bypass WAKE mode check since user initiated
          options.speak(data.reply, true);
        } else {
          console.log("[ConversationOrchestrator] Speech blocked by guards:", {
            power: currentBusState.power,
            muted: currentBusState.mute,
            voiceMode
          });
        }
      } else {
        console.log("[ConversationOrchestrator] Skipping speech:", {
          skipSpeech: options.skipSpeech,
          hasSpeak: !!options.speak
        });
      }

      // Success!
      return {
        success: true,
        response: data.reply
      };

    } catch (error: any) {
      // Handle errors
      console.error("[ConversationOrchestrator] Error:", error);
      
      if (error.name === 'AbortError') {
        return { 
          success: false, 
          error: "Request cancelled" 
        };
      }

      // Show error toast if available
      if (options.showToast) {
        options.showToast(
          "Conversation Error",
          error.message || "Failed to process conversation",
          "destructive"
        );
      }

      return {
        success: false,
        error: error.message || "Unknown error"
      };

    } finally {
      // Clear busy flag and active request
      this.state.isBusy = false;
      this.state.activeRequest = null;
      this.notify();
    }
  }

  // Get diagnostic info
  getDiagnostics() {
    return {
      isBusy: this.state.isBusy,
      lastUserInput: this.state.lastUserInput,
      lastBotResponse: this.state.lastBotResponse,
      lastTimestamp: this.state.lastTimestamp,
      timeSinceLastInteraction: Date.now() - this.state.lastTimestamp,
      hasActiveRequest: !!this.state.activeRequest
    };
  }

  // Reset state (for debugging)
  reset() {
    this.cancel();
    this.state = {
      isBusy: false,
      lastUserInput: "",
      lastBotResponse: "",
      lastTimestamp: 0,
      activeRequest: null
    };
    this.notify();
  }
}

// Export singleton instance
export const ConversationOrchestrator = new ConversationOrchestratorClass();

// Export type for state
export type { ConversationState };