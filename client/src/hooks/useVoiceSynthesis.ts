import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { voiceBus } from "../voice/voiceBus";
import { voiceOrchestrator } from "../voice/tts/orchestrator";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  currentUtterance: string;
  isMuted: boolean;
}

export function useVoiceSynthesis() {
  const [state, setState] = useState<VoiceSynthesisState>({
    isEnabled: false,
    isPlaying: false,
    currentUtterance: "",
    isMuted: false,
  });

  const { toast } = useToast();
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Initialize speech synthesis
  const initializeSpeechSynthesis = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      console.warn("[VoiceSynthesis] Speech synthesis not supported in this environment - operating in text-only mode");
      // Don't show error toast - allow system to work in text-only mode
      // Enable the system anyway to allow text processing
      setState(prev => ({ ...prev, isEnabled: true }));
      return true; // Return true to indicate system can continue
    }

    // Load voices
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      console.log(`[VoiceSynthesis] Loaded ${voices.length} voices`);
      
      if (voices.length > 0) {
        setState(prev => ({ ...prev, isEnabled: true }));
        console.log(`[VoiceSynthesis] TTS enabled with ${voices.length} voice${voices.length > 1 ? 's' : ''} available`);
        // Only show success toast if voices are actually available
        toast({
          title: "Voice Enabled",
          description: `Speech synthesis ready with ${voices.length} voice${voices.length > 1 ? 's' : ''} available.`,
        });
        return true;
      }
      return false;
    };

    // Try to load voices immediately
    if (loadVoices()) {
      return true;
    }

    // Listen for voices to be loaded
    let attempts = 0;
    const maxAttempts = 10;
    
    const voicesChangedHandler = () => {
      if (loadVoices()) {
        speechSynthesis.removeEventListener('voiceschanged', voicesChangedHandler);
      }
    };
    
    speechSynthesis.addEventListener('voiceschanged', voicesChangedHandler);

    // Poll for voices
    const pollInterval = setInterval(() => {
      attempts++;
      if (loadVoices() || attempts >= maxAttempts) {
        clearInterval(pollInterval);
        speechSynthesis.removeEventListener('voiceschanged', voicesChangedHandler);
        
        if (attempts >= maxAttempts) {
          // Just log that voices aren't available, don't show error
          console.warn("[VoiceSynthesis] No voices available - operating in text-only mode");
          // Enable the system anyway to allow text processing without TTS
          setState(prev => ({ ...prev, isEnabled: true }));
        }
      }
    }, 200);

    return true; // Always return true to allow system to continue
  }, [toast]);

  // Basic speak function using voiceOrchestrator
  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) {
      console.log("[VoiceSynthesis] No text to speak");
      return;
    }

    // Log the text we're attempting to speak
    console.log("[VoiceSynthesis] Response generated:", text);

    // Check if TTS is enabled
    if (!state.isEnabled) {
      console.log("[VoiceSynthesis] TTS not enabled (text-only mode). Response:", text);
      return;
    }

    // Check VoiceBus state
    const busState = voiceBus.getState();
    if (!busState.power || busState.mute) {
      console.log("[VoiceSynthesis] Speech blocked by VoiceBus:", busState);
      return;
    }

    // Check if voiceOrchestrator is ready
    if (!voiceOrchestrator.isReady()) {
      console.log("[VoiceSynthesis] VoiceOrchestrator not ready - text-only mode");
      console.log("[VoiceSynthesis] Response (text-only):", text);
      return;
    }

    // Update state to indicate we're playing
    setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    voiceBus.setSpeaking(true);

    try {
      // Use voiceOrchestrator to speak
      console.log("[VoiceSynthesis] Speaking through voiceOrchestrator:", text.slice(0, 50));
      
      await voiceOrchestrator.speak(text, {
        interrupt: true,
        callback: () => {
          console.log("[VoiceSynthesis] Finished speaking");
          voiceBus.setSpeaking(false);
          setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
        }
      });

      console.log("[VoiceSynthesis] Speech completed successfully");
      
    } catch (error) {
      console.error("[VoiceSynthesis] Failed to speak:", error);
      console.log("[VoiceSynthesis] Text-only fallback:", text);
      voiceBus.setSpeaking(false);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    }
  }, [state.isEnabled]);

  // Cancel speech
  const cancelSpeak = useCallback(() => {
    voiceOrchestrator.stop();
    voiceBus.setSpeaking(false);
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, []);

  // Handle speak events from VoiceBus
  useEffect(() => {
    const unsubscribeSpeak = voiceBus.on('speak', (event) => {
      if (event.text) {
        console.log("[VoiceSynthesis] Received speak event:", event.text.slice(0, 50));
        speakText(event.text);
      }
    });

    const unsubscribeMute = voiceBus.on('muteChange', (event) => {
      setState(prev => ({ ...prev, isMuted: event.muted || false }));
      if (event.muted) {
        cancelSpeak();
      }
    });

    const unsubscribePower = voiceBus.on('powerChange', (event) => {
      if (!event.powered) {
        cancelSpeak();
      }
    });

    const unsubscribeCancel = voiceBus.on('cancel', () => {
      cancelSpeak();
    });

    return () => {
      unsubscribeSpeak();
      unsubscribeMute();
      unsubscribePower();
      unsubscribeCancel();
    };
  }, [speakText, cancelSpeak]);

  // Initialize on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      console.log("[VoiceSynthesis] Initializing...");
      initializeSpeechSynthesis();
    }
  }, [initializeSpeechSynthesis]);

  // Public API matching the original interface
  const speak = useCallback((text: string) => {
    // Emit speak event to VoiceBus instead of speaking directly
    // This allows other components to intercept and process the text
    voiceBus.emitSpeak(text, 'system');
  }, []);

  const enable = useCallback(() => {
    return initializeSpeechSynthesis();
  }, [initializeSpeechSynthesis]);

  const disable = useCallback(() => {
    cancelSpeak();
    setState(prev => ({ ...prev, isEnabled: false }));
  }, [cancelSpeak]);

  const setMuted = useCallback((muted: boolean) => {
    voiceBus.setMute(muted);
  }, []);

  const setPower = useCallback((power: boolean) => {
    voiceBus.setPower(power);
  }, []);

  const setRequiresHumanSpeech = useCallback((required: boolean) => {
    // This is a no-op in the simplified version
    console.log("[VoiceSynthesis] setRequiresHumanSpeech is deprecated in simplified version");
  }, []);

  const updateLastHumanSpeech = useCallback(() => {
    // This is a no-op in the simplified version
    console.log("[VoiceSynthesis] updateLastHumanSpeech is deprecated in simplified version");
  }, []);

  const repeatLast = useCallback(() => {
    if (utteranceRef.current) {
      speakText(utteranceRef.current.text);
    }
  }, [speakText]);

  const changeAccent = useCallback(() => {
    // This is a no-op in the simplified version
    console.log("[VoiceSynthesis] changeAccent is deprecated in simplified version");
  }, []);

  const setAccentConfig = useCallback(() => {
    // This is a no-op in the simplified version
    console.log("[VoiceSynthesis] setAccentConfig is deprecated in simplified version");
  }, []);

  return {
    ...state,
    speak,
    enable,
    disable,
    cancel: cancelSpeak,
    setMuted,
    setPower,
    setRequiresHumanSpeech,
    updateLastHumanSpeech,
    repeatLast,
    changeAccent,
    setAccentConfig,
    // For backward compatibility, expose dummy accentConfig
    accentConfig: {
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.0,
      emotion: "neutral",
    },
    requiresHumanSpeech: false,
    lastHumanSpeechTime: 0,
  };
}