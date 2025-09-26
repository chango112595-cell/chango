import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyAccentToText, type AccentConfig } from "@/lib/accentEngine";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentUtterance: string;
  accentConfig: AccentConfig;
}

export function useVoiceSynthesisWithExport() {
  const [state, setState] = useState<VoiceSynthesisState>({
    isEnabled: false,
    isPlaying: false,
    isRecording: false,
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const setupAudioRecording = useCallback(async () => {
    try {
      // Create audio context for recording
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Create a destination for recording
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      return destination;
    } catch (error) {
      console.error("Failed to setup audio recording:", error);
      throw error;
    }
  }, []);

  const enable = useCallback(() => {
    if ("speechSynthesis" in window) {
      let attempts = 0;
      const maxAttempts = 10;
      
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        console.log("Available voices:", voices.length, "Attempt:", attempts + 1);
        
        if (voices.length > 0) {
          // Test utterance to enable speech synthesis
          const testUtterance = new SpeechSynthesisUtterance("");
          speechSynthesis.speak(testUtterance);
          
          setState(prev => ({ ...prev, isEnabled: true }));
          
          toast({
            title: "Voice Enabled",
            description: "Speech synthesis is now ready to use.",
          });
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(loadVoices, 200);
          } else {
            console.log("No voices available, enabling basic synthesis");
            setState(prev => ({ ...prev, isEnabled: true }));
            
            toast({
              title: "Voice Enabled", 
              description: "Speech synthesis enabled (basic mode).",
            });
          }
        }
      };

      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    } else {
      toast({
        title: "Speech Synthesis Unavailable",
        description: "Your browser doesn't support speech synthesis.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const speak = useCallback((text: string) => {
    if (!state.isEnabled || !text.trim()) {
      console.log("Speech blocked:", { enabled: state.isEnabled, hasText: !!text.trim() });
      return;
    }

    console.log("Starting speech synthesis:", { text, config: state.accentConfig });

    speechSynthesis.cancel();

    const processedText = applyAccentToText(text, state.accentConfig);
    lastUtteranceRef.current = text;

    const utterance = new SpeechSynthesisUtterance(processedText);
    utteranceRef.current = utterance;

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      utterance.voice = voices.find(voice => voice.default) || voices[0];
    }

    utterance.rate = Math.max(0.1, Math.min(10, state.accentConfig.rate));
    utterance.pitch = Math.max(0, Math.min(2, state.accentConfig.pitch));
    utterance.volume = 1.0;

    utterance.onstart = () => {
      console.log("Speech started");
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      console.log("Speech ended");
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event.error, event);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      
      if (event.error === "synthesis-failed" && voices.length === 0) {
        setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
        setTimeout(() => {
          setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
        }, 2000);
        
        toast({
          title: "Speech Simulated",
          description: "Speech synthesis simulated (testing environment)",
        });
      } else {
        toast({
          title: "Speech Error",
          description: `Error occurred: ${event.error}`,
          variant: "destructive",
        });
      }
    };

    try {
      speechSynthesis.speak(utterance);
      
      if (voices.length === 0) {
        setTimeout(() => {
          if (utterance.onerror) {
            utterance.onerror({ error: 'synthesis-failed' } as any);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Failed to start speech synthesis:", error);
      
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
      setTimeout(() => {
        setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      }, 2000);
      
      toast({
        title: "Speech Simulated",
        description: "Speech synthesis simulated (fallback mode)",
      });
    }
  }, [state.isEnabled, state.accentConfig, toast]);

  const exportAudio = useCallback(async (text: string, route: string = "client"): Promise<Blob> => {
    if (!text.trim()) {
      throw new Error("No text provided for export");
    }

    try {
      setState(prev => ({ ...prev, isRecording: true }));
      
      // For cloud TTS routes, get audio from server
      if (route === "elevenlabs" || route === "azure") {
        const response = await fetch("/api/tts/audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text.trim(),
            route: route
          }),
        });

        if (!response.ok) {
          throw new Error(`Server audio synthesis failed: ${response.status}`);
        }

        const blob = await response.blob();
        setState(prev => ({ ...prev, isRecording: false }));
        return blob;
      }

      // For client route, Web Speech API cannot be reliably captured
      throw new Error("Audio export is not supported for browser-based speech synthesis. Use ElevenLabs or Azure routes for audio export.");

    } catch (error) {
      setState(prev => ({ ...prev, isRecording: false }));
      throw error;
    }
  }, []);

  const downloadAudio = useCallback((audioBlob: Blob, filename: string = 'chango-speech.webm') => {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setState(prev => ({ ...prev, isPlaying: false, isRecording: false, currentUtterance: "" }));
  }, []);

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
    applyAccent,
    repeatWithAccent,
    exportAudio,
    downloadAudio,
  };
}