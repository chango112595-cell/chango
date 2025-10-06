/**
 * Chango Voice Modules Integration
 * ================================
 * 
 * This file integrates the advanced Chango voice modules with the existing app
 * by importing the bootstrap module and wiring up UI elements via data attributes.
 */

import { 
  ui, 
  vad, 
  mfcc, 
  tts, 
  stt, 
  wake, 
  unlock, 
  speak, 
  stop, 
  bus, 
  ctxPool 
} from './chango/bootstrap.js';

// Initialize Chango when DOM is ready
function initializeChango() {
  console.log('[Chango Integration] Initializing Chango voice modules...');
  
  // The UI adapter will automatically find elements with data-chango-* attributes
  // and bind them to the voice functionality
  
  // Listen for voice events and integrate with existing conversation flow
  bus.on('status', (status) => {
    console.log('[Chango] Status:', status);
    
    // Update any existing status displays
    const statusElements = document.querySelectorAll('[data-chango-status]');
    statusElements.forEach(el => {
      el.textContent = status;
    });
  });
  
  // Listen for STT results and forward to conversation engine
  bus.on('stt:result', (transcript) => {
    console.log('[Chango] Speech recognized:', transcript);
    
    // Emit event for the existing conversation engine
    if (window.voiceBus) {
      window.voiceBus.emit({
        type: 'userSpeechRecognized',
        text: transcript
      });
    }
  });
  
  // Listen for TTS requests from the existing app
  if (window.voiceBus) {
    window.voiceBus.on('speak', (event) => {
      if (event.text) {
        console.log('[Chango] Speaking via TTS:', event.text);
        speak(event.text);
      }
    });
  }
  
  // Listen for wake word detection
  bus.on('wake:detected', () => {
    console.log('[Chango] Wake word detected!');
    
    // Open the gate for voice input
    if (window.voiceGate) {
      window.voiceGate.open();
    }
  });
  
  // Listen for VAD (Voice Activity Detection) events
  bus.on('vad:start', () => {
    console.log('[Chango] Voice activity started');
  });
  
  bus.on('vad:stop', () => {
    console.log('[Chango] Voice activity stopped');
  });
  
  // Expose Chango API to window for debugging and external access
  window.__chango = {
    speak,
    stop,
    unlock,
    stt,
    tts,
    wake,
    vad,
    mfcc,
    bus,
    ui,
    status: {
      isReady: false,
      isListening: false,
      isSpeaking: false
    },
    // Helper function to manually trigger wake word
    triggerWakeWord: () => {
      bus.emit('wake:detected');
    },
    // Helper function to enroll a new wake word
    enrollWakeWord: (samples) => {
      wake.enroll(samples);
      console.log('[Chango] Wake word enrolled');
    },
    // Get current audio context state
    getAudioState: () => {
      return ctxPool.state;
    }
  };
  
  // Update ready status when audio is unlocked
  bus.on('status', (status) => {
    if (status === 'ready') {
      window.__chango.status.isReady = true;
    }
  });
  
  console.log('[Chango Integration] Chango modules initialized and exposed to window.__chango');
  console.log('[Chango Integration] UI adapter will bind to elements with data-chango-* attributes');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChango);
} else {
  // DOM is already ready
  initializeChango();
}

// Export for ES6 module usage
export { 
  speak, 
  stop, 
  unlock, 
  bus,
  initializeChango 
};