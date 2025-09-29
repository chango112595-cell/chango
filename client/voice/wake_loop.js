// Chango AI Wake Word Detection Loop
// Hands-free voice interaction with wake word detection

class WakeWordLoop {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      wakeWord: config.wakeWord || 'chango',
      cooldownMs: config.cooldownMs || 2500,
      maxUtteranceMs: config.maxUtteranceMs || 8000,
      silenceTimeoutMs: config.silenceTimeoutMs || 1500,
      minConfidence: config.minConfidence || 0.6,
      enabled: false,
      ...config
    };

    // State tracking
    this.state = {
      isListening: false,
      isProcessing: false,
      inCooldown: false,
      lastTriggerTime: 0,
      lastResponseTime: 0,
      sessionActive: false
    };

    // Callbacks
    this.onWakeWord = config.onWakeWord || (() => {});
    this.onCommand = config.onCommand || (() => {});
    this.onResponse = config.onResponse || (() => {});
    this.onError = config.onError || (() => {});
    this.onStateChange = config.onStateChange || (() => {});

    // Speech recognition setup
    this.recognition = null;
    this.vadCallbacks = null;
    this.utteranceTimeout = null;
    this.silenceTimeout = null;
    this.commandBuffer = '';
    
    // Initialize speech recognition
    this.initializeSpeechRecognition();
  }

  initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('[WakeWordLoop] Speech recognition not supported');
      this.onError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = 'en-US';

    // Set up event handlers
    this.recognition.onresult = (event) => this.handleSpeechResult(event);
    this.recognition.onerror = (event) => this.handleSpeechError(event);
    this.recognition.onend = () => this.handleSpeechEnd();
    this.recognition.onstart = () => {
      console.log('[WakeWordLoop] Speech recognition started');
      this.updateState({ isListening: true });
    };
  }

  // Start the wake word detection loop
  start(vadHooks = null) {
    if (!this.recognition) {
      console.error('[WakeWordLoop] Speech recognition not initialized');
      return false;
    }

    // Store VAD hooks if provided
    if (vadHooks) {
      this.vadCallbacks = vadHooks;
    }

    this.config.enabled = true;
    this.state.isListening = false;
    this.state.isProcessing = false;
    this.state.inCooldown = false;
    
    console.log('[WakeWordLoop] Starting wake word detection for:', this.config.wakeWord);
    
    try {
      this.recognition.start();
      this.updateState({ isListening: true });
      return true;
    } catch (error) {
      console.error('[WakeWordLoop] Failed to start recognition:', error);
      this.onError(error.message);
      return false;
    }
  }

  // Stop the wake word detection loop
  stop() {
    this.config.enabled = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    this.clearTimeouts();
    this.updateState({ 
      isListening: false, 
      isProcessing: false,
      sessionActive: false 
    });
    
    console.log('[WakeWordLoop] Stopped wake word detection');
  }

  // Handle speech recognition results
  handleSpeechResult(event) {
    if (!this.config.enabled) return;

    const currentTime = Date.now();
    
    // Get the latest result
    const resultIndex = event.resultIndex;
    const result = event.results[resultIndex];
    const transcript = result[0].transcript.toLowerCase().trim();
    const isFinal = result.isFinal;
    const confidence = result[0].confidence || 0.7;

    console.log('[WakeWordLoop] Speech result:', { 
      transcript, 
      isFinal, 
      confidence,
      sessionActive: this.state.sessionActive
    });

    // Check for cooldown
    if (this.state.inCooldown) {
      const timeSinceTrigger = currentTime - this.state.lastTriggerTime;
      if (timeSinceTrigger < this.config.cooldownMs) {
        console.log('[WakeWordLoop] In cooldown, ignoring speech');
        return;
      }
      this.state.inCooldown = false;
    }

    // If not in active session, look for wake word
    if (!this.state.sessionActive) {
      const hasWakeWord = this.detectWakeWord(transcript);
      
      if (hasWakeWord) {
        console.log('[WakeWordLoop] Wake word detected!');
        
        // Start session
        this.state.sessionActive = true;
        this.state.lastTriggerTime = currentTime;
        this.commandBuffer = '';
        
        // Extract command after wake word if present
        const wakeWordIndex = transcript.indexOf(this.config.wakeWord);
        const afterWakeWord = transcript.substring(wakeWordIndex + this.config.wakeWord.length).trim();
        
        if (afterWakeWord) {
          this.commandBuffer = afterWakeWord;
        }
        
        // Notify wake word detection
        this.onWakeWord(transcript);
        this.updateState({ sessionActive: true });
        
        // Start utterance timeout
        this.startUtteranceTimeout();
        
        // If there's already a complete command after wake word, process it
        if (isFinal && afterWakeWord) {
          this.processCommand(afterWakeWord);
        }
      }
    } else {
      // In active session, accumulate command
      if (!this.commandBuffer || isFinal) {
        // Replace buffer with new transcript if final
        this.commandBuffer = transcript;
      } else {
        // Update with interim results
        this.commandBuffer = transcript;
      }
      
      // Reset silence timeout on new speech
      this.resetSilenceTimeout();
      
      // Process if final
      if (isFinal && this.commandBuffer) {
        this.processCommand(this.commandBuffer);
      }
    }
  }

  // Detect wake word in transcript
  detectWakeWord(transcript) {
    const wakeWordLower = this.config.wakeWord.toLowerCase();
    return transcript.includes(wakeWordLower);
  }

  // Process recognized command
  async processCommand(command) {
    if (!command || this.state.isProcessing) return;

    console.log('[WakeWordLoop] Processing command:', command);
    
    this.state.isProcessing = true;
    this.clearTimeouts();
    this.updateState({ isProcessing: true });

    try {
      // Send command to NLP endpoint
      const response = await fetch('/api/nlp/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: command,
          context: {
            wakeWord: this.config.wakeWord,
            sessionId: Date.now().toString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`NLP API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle the response
      if (data.reply) {
        console.log('[WakeWordLoop] Got reply:', data.reply);
        this.onResponse(data.reply, command);
        
        // Use voice synthesis to speak the response if available
        if (window.voiceSynthesis) {
          this.speakResponse(data.reply);
        }
      }

      // Callback with command and response
      this.onCommand(command, data);
      
    } catch (error) {
      console.error('[WakeWordLoop] Error processing command:', error);
      this.onError(error.message);
    } finally {
      // End session and start cooldown
      this.endSession();
    }
  }

  // Speak the response using Web Speech API
  speakResponse(text) {
    if (!window.voiceSynthesis || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to use a natural voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Natural') || 
      voice.default
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      console.log('[WakeWordLoop] Finished speaking response');
      this.state.lastResponseTime = Date.now();
    };

    window.speechSynthesis.speak(utterance);
  }

  // End the current session
  endSession() {
    console.log('[WakeWordLoop] Ending session, starting cooldown');
    
    this.state.sessionActive = false;
    this.state.isProcessing = false;
    this.state.inCooldown = true;
    this.state.lastTriggerTime = Date.now();
    this.commandBuffer = '';
    
    this.clearTimeouts();
    this.updateState({ 
      sessionActive: false, 
      isProcessing: false,
      inCooldown: true 
    });
    
    // Clear cooldown after configured time
    setTimeout(() => {
      this.state.inCooldown = false;
      this.updateState({ inCooldown: false });
      console.log('[WakeWordLoop] Cooldown ended, ready for next wake word');
    }, this.config.cooldownMs);
  }

  // Start utterance timeout
  startUtteranceTimeout() {
    this.clearTimeouts();
    
    this.utteranceTimeout = setTimeout(() => {
      console.log('[WakeWordLoop] Max utterance time reached');
      if (this.commandBuffer) {
        this.processCommand(this.commandBuffer);
      } else {
        this.endSession();
      }
    }, this.config.maxUtteranceMs);
    
    // Also start silence timeout
    this.resetSilenceTimeout();
  }

  // Reset silence timeout
  resetSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    
    this.silenceTimeout = setTimeout(() => {
      console.log('[WakeWordLoop] Silence timeout reached');
      if (this.state.sessionActive && this.commandBuffer) {
        this.processCommand(this.commandBuffer);
      } else if (this.state.sessionActive) {
        this.endSession();
      }
    }, this.config.silenceTimeoutMs);
  }

  // Clear all timeouts
  clearTimeouts() {
    if (this.utteranceTimeout) {
      clearTimeout(this.utteranceTimeout);
      this.utteranceTimeout = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  // Handle speech recognition errors
  handleSpeechError(event) {
    console.error('[WakeWordLoop] Speech recognition error:', event.error);
    
    if (event.error === 'no-speech') {
      // This is normal, just restart
      if (this.config.enabled && !this.state.isListening) {
        this.restart();
      }
    } else if (event.error === 'audio-capture') {
      this.onError('Microphone access denied or unavailable');
      this.stop();
    } else if (event.error === 'not-allowed') {
      this.onError('Speech recognition permission denied');
      this.stop();
    } else {
      this.onError(`Speech recognition error: ${event.error}`);
    }
  }

  // Handle speech recognition end
  handleSpeechEnd() {
    console.log('[WakeWordLoop] Speech recognition ended');
    this.updateState({ isListening: false });
    
    // Restart if still enabled
    if (this.config.enabled) {
      setTimeout(() => this.restart(), 100);
    }
  }

  // Restart speech recognition
  restart() {
    if (!this.config.enabled) return;
    
    try {
      this.recognition.start();
    } catch (error) {
      // Already started, ignore
    }
  }

  // Update and broadcast state changes
  updateState(changes) {
    const oldState = { ...this.state };
    Object.assign(this.state, changes);
    
    // Notify state change
    this.onStateChange(this.state, oldState);
  }

  // Set wake word
  setWakeWord(word) {
    if (word && typeof word === 'string') {
      this.config.wakeWord = word.toLowerCase();
      console.log('[WakeWordLoop] Wake word updated to:', this.config.wakeWord);
    }
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Get configuration
  getConfig() {
    return { ...this.config };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WakeWordLoop;
} else {
  window.WakeWordLoop = WakeWordLoop;
}