import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyAccentToText, type AccentConfig } from "@/lib/accentEngine";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  currentUtterance: string;
  accentConfig: AccentConfig;
}

export function useVoiceSynthesis() {
  const [state, setState] = useState<VoiceSynthesisState>({
    isEnabled: false,
    isPlaying: false,
    currentUtterance: "",
    accentConfig: {
      profile: "neutral",
      intensity: 0.5,
      rate: 1.0,
      pitch: 1.0,
    },
  });

  const { toast } = useToast();
  const lastUtteranceRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const enable = useCallback(() => {
    if ("speechSynthesis" in window) {
      // Test utterance to enable speech synthesis
      const testUtterance = new SpeechSynthesisUtterance("");
      speechSynthesis.speak(testUtterance);
      
      setState(prev => ({ ...prev, isEnabled: true }));
      
      toast({
        title: "Voice Enabled",
        description: "Speech synthesis is now ready to use.",
      });
    } else {
      toast({
        title: "Speech Synthesis Unavailable",
        description: "Your browser doesn't support speech synthesis.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const speak = useCallback((text: string) => {
    if (!state.isEnabled || !text.trim()) return;

    // Stop any ongoing speech
    speechSynthesis.cancel();

    // Apply accent transformation
    const processedText = applyAccentToText(text, state.accentConfig);
    lastUtteranceRef.current = text;

    const utterance = new SpeechSynthesisUtterance(processedText);
    utteranceRef.current = utterance;

    // Apply voice parameters
    utterance.rate = state.accentConfig.rate;
    utterance.pitch = state.accentConfig.pitch;
    utterance.volume = 1.0;

    // Set up event handlers
    utterance.onstart = () => {
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event) => {
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      toast({
        title: "Speech Error",
        description: `Error occurred during speech synthesis: ${event.error}`,
        variant: "destructive",
      });
    };

    speechSynthesis.speak(utterance);
  }, [state.isEnabled, state.accentConfig, toast]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, []);

  const test = useCallback(() => {
    speak("Hello, I'm Chango. How can I help you today?");
  }, [speak]);

  const applyAccent = useCallback((config: Partial<AccentConfig>) => {
    setState(prev => ({
      ...prev,
      accentConfig: { ...prev.accentConfig, ...config }
    }));
    
    toast({
      title: "Accent Applied",
      description: `Voice accent updated to ${config.profile || state.accentConfig.profile}`,
    });
  }, [toast, state.accentConfig.profile]);

  const repeatWithAccent = useCallback(() => {
    if (lastUtteranceRef.current) {
      speak(lastUtteranceRef.current);
    }
  }, [speak]);

  return {
    ...state,
    enable,
    speak,
    stop,
    test,
    applyAccent,
    repeatWithAccent,
  };
}
