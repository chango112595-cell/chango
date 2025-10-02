import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { voiceBus } from "../voice/voiceBus";

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
      console.error("[VoiceSynthesis] Speech synthesis not supported");
      toast({
        title: "Speech Synthesis Unavailable",
        description: "Your browser doesn't support speech synthesis.",
        variant: "destructive",
      });
      return false;
    }

    // Load voices
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      console.log(`[VoiceSynthesis] Loaded ${voices.length} voices`);
      
      if (voices.length > 0) {
        setState(prev => ({ ...prev, isEnabled: true }));
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
          console.error("[VoiceSynthesis] Failed to load voices");
          toast({
            title: "Voice Loading Failed",
            description: "Unable to load speech synthesis voices.",
            variant: "destructive",
          });
        }
      }
    }, 200);

    return true;
  }, [toast]);

  // Basic speak function without prosody
  const speakText = useCallback((text: string) => {
    if (!state.isEnabled || !text.trim()) {
      console.log("[VoiceSynthesis] Cannot speak:", { enabled: state.isEnabled, hasText: !!text.trim() });
      return;
    }

    // Check VoiceBus state
    const busState = voiceBus.getState();
    if (!busState.power || busState.mute) {
      console.log("[VoiceSynthesis] Speech blocked by VoiceBus:", busState);
      return;
    }

    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Get available voices and select a good one
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferredVoice = voices.find(voice => 
        voice.name.includes("Google") || 
        voice.name.includes("Natural") || 
        voice.name.includes("Premium") ||
        voice.name.includes("Enhanced")
      ) || voices.find(voice => voice.default) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    // Set default speech parameters
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Set up event handlers
    utterance.onstart = () => {
      console.log("[VoiceSynthesis] Started speaking:", text.slice(0, 50));
      voiceBus.setSpeaking(true);
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      console.log("[VoiceSynthesis] Finished speaking");
      voiceBus.setSpeaking(false);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event: any) => {
      console.error("[VoiceSynthesis] Speech error:", event.error);
      voiceBus.setSpeaking(false);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    // Speak the utterance
    try {
      speechSynthesis.speak(utterance);
      console.log("[VoiceSynthesis] Speaking:", text.slice(0, 50));
    } catch (error) {
      console.error("[VoiceSynthesis] Failed to speak:", error);
      voiceBus.setSpeaking(false);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    }
  }, [state.isEnabled]);

  // Cancel speech
  const cancelSpeak = useCallback(() => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
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