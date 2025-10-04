// TTS Browser Module - Provides speakBrowser function and VoiceBus state
// This module handles text-to-speech functionality for the browser

// VoiceBus - Global voice state manager
const VoiceBus = {
  power: true,      // Whether voice is enabled
  mute: false,      // Whether voice is muted
  speaking: false,  // Whether currently speaking
  voices: [],       // Available voices
  selectedVoice: null
};

// Initialize voices when they become available
function loadVoices() {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length > 0) {
    VoiceBus.voices = voices;
    // Try to select a good default voice
    VoiceBus.selectedVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Natural') || 
      v.default
    ) || voices[0];
  }
  return voices;
}

// Load voices on page load and when they change
if (typeof window !== 'undefined' && window.speechSynthesis) {
  // Initial load
  loadVoices();
  
  // Reload when voices change (happens on some browsers)
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Main speak function for browser
async function speakBrowser(options = {}) {
  // Extract options with defaults
  const {
    text = '',
    accent = 'en-US',
    rate = 1,
    pitch = 1,
    volume = 1,
    voice = null
  } = options;
  
  // Check if we can speak
  if (!text || !text.trim()) {
    console.warn('[TTS] No text to speak');
    return false;
  }
  
  if (!window.speechSynthesis) {
    console.error('[TTS] Speech synthesis not supported');
    return false;
  }
  
  if (VoiceBus.mute || !VoiceBus.power) {
    console.log('[TTS] Voice is muted or disabled');
    return false;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  // Create utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  utterance.lang = accent;
  
  // Set voice if specified or use selected voice
  if (voice) {
    const foundVoice = VoiceBus.voices.find(v => v.name === voice);
    if (foundVoice) {
      utterance.voice = foundVoice;
    }
  } else if (VoiceBus.selectedVoice) {
    utterance.voice = VoiceBus.selectedVoice;
  } else {
    // Try to find a voice for the accent
    const accentVoice = VoiceBus.voices.find(v => v.lang.startsWith(accent.split('-')[0]));
    if (accentVoice) {
      utterance.voice = accentVoice;
    }
  }
  
  // Set up event handlers
  return new Promise((resolve) => {
    utterance.onstart = () => {
      VoiceBus.speaking = true;
      console.log('[TTS] Started speaking:', text.substring(0, 50) + '...');
    };
    
    utterance.onend = () => {
      VoiceBus.speaking = false;
      console.log('[TTS] Finished speaking');
      resolve(true);
    };
    
    utterance.onerror = (event) => {
      VoiceBus.speaking = false;
      console.error('[TTS] Speech error:', event.error);
      resolve(false);
    };
    
    // Start speaking
    window.speechSynthesis.speak(utterance);
  });
}

// Utility functions
function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    VoiceBus.speaking = false;
  }
}

function pauseSpeaking() {
  if (window.speechSynthesis && VoiceBus.speaking) {
    window.speechSynthesis.pause();
  }
}

function resumeSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
}

// Export for ES6 modules
export { speakBrowser, VoiceBus, stopSpeaking, pauseSpeaking, resumeSpeaking, loadVoices };