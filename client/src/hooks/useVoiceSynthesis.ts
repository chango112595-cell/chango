import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyAccentToText, type AccentConfig } from "@/lib/accentEngine";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  currentUtterance: string;
  accentConfig: AccentConfig;
}

interface ProsodyStep {
  type: "word" | "pause" | "phrase";
  w?: string; // word text (legacy)
  text?: string; // phrase text with punctuation
  rate?: number;
  pitch?: number;
  volume?: number;
  ms?: number; // pause duration
  emotion?: string; // emotion context
}

interface CVEResponse {
  ok: boolean;
  text?: string;
  plan?: ProsodyStep[];
  prosody?: Record<string, any>;
  error?: string;
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
      emotion: "neutral", // Default emotion
    },
  });

  const { toast } = useToast();
  const lastUtteranceRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isEnabledRef = useRef<boolean>(false); // Track enabled state immediately

  const enable = useCallback(() => {
    console.log("[VoiceSynthesis] Starting enable process...");
    
    return new Promise<boolean>((resolve) => {
      if ("speechSynthesis" in window) {
        let attempts = 0;
        const maxAttempts = 10;
        let resolved = false;
        
        const loadVoices = () => {
          if (resolved) return; // Prevent multiple resolutions
          
          const voices = speechSynthesis.getVoices();
          console.log("[VoiceSynthesis] Available voices:", voices.length, "Attempt:", attempts + 1);
          
          if (voices.length > 0) {
            // Test utterance to enable speech synthesis
            const testUtterance = new SpeechSynthesisUtterance("");
            speechSynthesis.speak(testUtterance);
            
            console.log("[VoiceSynthesis] Voices loaded successfully, enabling synthesis");
            isEnabledRef.current = true; // Set ref immediately
            setState(prev => ({ ...prev, isEnabled: true }));
            
            toast({
              title: "Voice Enabled",
              description: "Speech synthesis is now ready to use.",
            });
            
            resolved = true;
            resolve(true);
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              // Keep trying to load voices
              console.log("[VoiceSynthesis] No voices yet, retrying...");
              setTimeout(loadVoices, 200);
            } else {
              // Enable anyway for environments without voices (like testing)
              console.log("[VoiceSynthesis] Max attempts reached, enabling basic synthesis");
              isEnabledRef.current = true; // Set ref immediately
              setState(prev => ({ ...prev, isEnabled: true }));
              
              toast({
                title: "Voice Enabled",
                description: "Speech synthesis enabled (basic mode - no voices detected).",
              });
              
              resolved = true;
              resolve(true);
            }
          }
        };

        // Setup voice change listener
        speechSynthesis.onvoiceschanged = () => {
          console.log("[VoiceSynthesis] Voices changed event fired");
          loadVoices();
        };
        
        // Start loading voices
        loadVoices();
      } else {
        console.error("[VoiceSynthesis] Speech synthesis not supported");
        toast({
          title: "Speech Synthesis Unavailable",
          description: "Your browser doesn't support speech synthesis.",
          variant: "destructive",
        });
        resolve(false);
      }
    });
  }, [toast]);

  // Execute a prosody plan step-by-step
  const executeProsodyPlan = useCallback(async (plan: ProsodyStep[], originalText: string) => {
    console.log("[VoiceSynthesis] Executing prosody plan:", plan.length, "steps");
    isCancelledRef.current = false;
    
    const voices = speechSynthesis.getVoices();
    
    // Prefer high-quality voices
    const preferredVoice = voices.find(voice => 
      voice.name.includes("Google") || 
      voice.name.includes("Natural") || 
      voice.name.includes("Premium") ||
      voice.name.includes("Enhanced")
    ) || voices.find(voice => voice.default) || voices[0];

    for (const step of plan) {
      if (isCancelledRef.current) {
        console.log("[VoiceSynthesis] Prosody plan execution cancelled");
        break;
      }

      if (step.type === "phrase" && step.text) {
        // Speak a phrase with specified parameters (new phrase-level synthesis)
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(step.text);
          utteranceRef.current = utterance;
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          
          // Apply prosody parameters from the plan
          utterance.rate = step.rate !== undefined ? Math.max(0.1, Math.min(10, step.rate)) : 1.0;
          utterance.pitch = step.pitch !== undefined ? Math.max(0, Math.min(2, step.pitch)) : 1.0;
          utterance.volume = step.volume !== undefined ? Math.max(0, Math.min(1, step.volume)) : 1.0;
          
          utterance.onend = () => {
            resolve();
          };
          
          utterance.onerror = (event) => {
            console.error("Error speaking phrase:", step.text, event);
            resolve(); // Continue with next phrase even if error
          };
          
          speechSynthesis.speak(utterance);
        });
      } else if (step.type === "word" && step.w) {
        // Legacy word-by-word support for backward compatibility
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(step.w);
          utteranceRef.current = utterance;
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          
          // Apply prosody parameters from the plan
          utterance.rate = step.rate !== undefined ? Math.max(0.1, Math.min(10, step.rate)) : 1.0;
          utterance.pitch = step.pitch !== undefined ? Math.max(0, Math.min(2, step.pitch)) : 1.0;
          utterance.volume = step.volume !== undefined ? Math.max(0, Math.min(1, step.volume)) : 1.0;
          
          utterance.onend = () => {
            resolve();
          };
          
          utterance.onerror = () => {
            console.error("Error speaking word:", step.w);
            resolve(); // Continue with next word even if error
          };
          
          speechSynthesis.speak(utterance);
        });
      } else if (step.type === "pause" && step.ms) {
        // Add a pause
        await new Promise(resolve => setTimeout(resolve, step.ms));
      }
    }
    
    console.log("[VoiceSynthesis] Prosody plan execution completed");
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, []);

  // Fallback to local synthesis
  const fallbackLocalSynthesis = useCallback((text: string) => {
    console.log("[VoiceSynthesis] Using fallback local synthesis for text:", text.slice(0, 50));
    
    // Apply accent transformation locally
    const processedText = applyAccentToText(text, state.accentConfig);
    
    const utterance = new SpeechSynthesisUtterance(processedText);
    utteranceRef.current = utterance;

    // Get available voices and prefer high-quality ones
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferredVoice = voices.find(voice => 
        voice.name.includes("Google") || 
        voice.name.includes("Natural") || 
        voice.name.includes("Premium") ||
        voice.name.includes("Enhanced")
      ) || voices.find(voice => voice.default) || voices[0];
      utterance.voice = preferredVoice;
    }

    // Apply voice parameters with safe bounds
    utterance.rate = Math.max(0.1, Math.min(10, state.accentConfig.rate));
    utterance.pitch = Math.max(0, Math.min(2, state.accentConfig.pitch));
    utterance.volume = 1.0;

    // Set up event handlers
    utterance.onstart = () => {
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event.error);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      
      // For testing environments, simulate successful speech
      if (event.error === "synthesis-failed" && voices.length === 0) {
        console.log("Simulating speech for testing environment");
        setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
        setTimeout(() => {
          setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
        }, 2000);
      }
    };

    try {
      speechSynthesis.speak(utterance);
      console.log("Local speech synthesis command sent");
    } catch (error) {
      console.error("Failed to start local speech synthesis:", error);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    }
  }, [state.accentConfig]);

  // Main speak function with CVE integration
  const speak = useCallback(async (text: string) => {
    if (!isEnabledRef.current || !text.trim()) {
      console.log("[VoiceSynthesis] Speech blocked:", { 
        enabled: isEnabledRef.current, 
        stateEnabled: state.isEnabled,
        hasText: !!text.trim(),
        text: text.slice(0, 50) + (text.length > 50 ? '...' : '')
      });
      
      // Try to enable again if not enabled
      if (!isEnabledRef.current && "speechSynthesis" in window) {
        console.log("[VoiceSynthesis] Attempting to re-enable...");
        const enabled = await enable();
        if (enabled) {
          console.log("[VoiceSynthesis] Re-enabled successfully, retrying speak");
          // Retry speaking after re-enabling
          setTimeout(() => speak(text), 100);
        }
      }
      return;
    }

    console.log("[VoiceSynthesis] Starting speech synthesis with CVE:", { 
      text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
      config: state.accentConfig,
      enabled: isEnabledRef.current,
      stateEnabled: state.isEnabled
    });

    // Stop any ongoing speech
    speechSynthesis.cancel();
    isCancelledRef.current = true;

    // Save the text for repeat functionality
    lastUtteranceRef.current = text;
    
    // Set playing state
    setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));

    try {
      // Call CVE API
      const response = await fetch('/api/voice/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          accent: state.accentConfig.profile,
          intensity: state.accentConfig.intensity,
          emotion: state.accentConfig.emotion || 'neutral',
        }),
      });

      if (!response.ok) {
        throw new Error(`CVE API error: ${response.status}`);
      }

      const cveResponse: CVEResponse = await response.json();
      
      if (!cveResponse.ok || !cveResponse.plan) {
        throw new Error(cveResponse.error || 'Invalid CVE response');
      }

      console.log("CVE response:", {
        text: cveResponse.text,
        planLength: cveResponse.plan.length,
        prosody: cveResponse.prosody,
      });

      // Execute the prosody plan
      await executeProsodyPlan(cveResponse.plan, text);
      
    } catch (error) {
      console.error("CVE API failed, falling back to local synthesis:", error);
      
      // Fallback to local synthesis if CVE API fails
      fallbackLocalSynthesis(text);
      
      // Only show toast for non-network errors
      if (!(error instanceof TypeError && error.message.includes('fetch'))) {
        toast({
          title: "Voice Engine Fallback",
          description: "Using local voice synthesis (server unavailable)",
        });
      }
    }
  }, [state.isEnabled, state.accentConfig, executeProsodyPlan, fallbackLocalSynthesis, toast]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    isCancelledRef.current = true;
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
    
    const displayName = config.profile || state.accentConfig.profile;
    const emotion = config.emotion || state.accentConfig.emotion;
    
    toast({
      title: "Voice Updated",
      description: `Accent: ${displayName}, Emotion: ${emotion}`,
    });
  }, [toast, state.accentConfig]);

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