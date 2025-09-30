import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyAccentToText, type AccentConfig } from "@/lib/accentEngine";
import { VoiceBus, cancelSpeak } from "@/lib/voiceBus";
import { Voice } from "@/lib/voiceController";

interface VoiceSynthesisState {
  isEnabled: boolean;
  isPlaying: boolean;
  currentUtterance: string;
  accentConfig: AccentConfig;
  isMuted: boolean;
  requiresHumanSpeech: boolean;
  lastHumanSpeechTime: number;
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
    isMuted: false,
    requiresHumanSpeech: false,
    lastHumanSpeechTime: 0,
  });

  const { toast } = useToast();
  const lastUtteranceRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isEnabledRef = useRef<boolean>(false); // Track enabled state immediately
  const isSpeakingRef = useRef<boolean>(false); // Track if currently speaking
  const isMutedRef = useRef<boolean>(false); // Track mute state immediately
  const isExecutingProsodyRef = useRef<boolean>(false); // Prevent concurrent prosody executions
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Safety timeout for infinite loops

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
    // Prevent concurrent executions
    if (isExecutingProsodyRef.current) {
      console.log("[VoiceSynthesis] Prosody execution already in progress, skipping");
      return;
    }
    
    console.log("[VoiceSynthesis] Executing prosody plan:", plan.length, "steps");
    isExecutingProsodyRef.current = true;
    isCancelledRef.current = false;
    isSpeakingRef.current = true;
    VoiceBus.setSpeaking(true);
    Voice.speaking(true); // Notify Voice controller we're speaking
    
    // Set safety timeout to prevent infinite loops
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    safetyTimeoutRef.current = setTimeout(() => {
      console.error("[VoiceSynthesis] Safety timeout triggered - stopping speech");
      speechSynthesis.cancel();
      isExecutingProsodyRef.current = false;
      isSpeakingRef.current = false;
      VoiceBus.setSpeaking(false);
      Voice.speaking(false);
    }, 30000); // 30 second safety timeout
    
    const voices = speechSynthesis.getVoices();
    
    // Prefer high-quality voices
    const preferredVoice = voices.find(voice => 
      voice.name.includes("Google") || 
      voice.name.includes("Natural") || 
      voice.name.includes("Premium") ||
      voice.name.includes("Enhanced")
    ) || voices.find(voice => voice.default) || voices[0];

    for (const step of plan) {
      // Early return check before each step to prevent recursion
      const busState = VoiceBus.getState();
      if (!busState.power || busState.mute || isCancelledRef.current || isMutedRef.current || !isSpeakingRef.current) {
        console.log("[VoiceSynthesis] Prosody plan execution stopped:", { 
          power: busState.power,
          muted: busState.mute || isMutedRef.current,
          cancelled: isCancelledRef.current,
          speaking: isSpeakingRef.current
        });
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
          
          // Apply prosody parameters from the plan, combining with base accent config
          const baseRate = state.accentConfig.rate || 1.0;
          const basePitch = state.accentConfig.pitch || 1.0;
          utterance.rate = step.rate !== undefined ? Math.max(0.1, Math.min(10, step.rate * baseRate)) : baseRate;
          utterance.pitch = step.pitch !== undefined ? Math.max(0, Math.min(2, step.pitch * basePitch)) : basePitch;
          utterance.volume = step.volume !== undefined ? Math.max(0, Math.min(1, step.volume)) : 1.0;
          
          utterance.onend = () => {
            resolve();
          };
          
          utterance.onerror = (event: any) => {
            // Don't log error if it's due to cancellation and we're muted or cancelled
            if (!((event.error === 'canceled' || event.error === 'interrupted') && (isMutedRef.current || isCancelledRef.current))) {
              console.error("Error speaking phrase:", step.text, event);
            }
            // Stop execution on error to prevent stack overflow
            isCancelledRef.current = true;
            resolve();
          };
          
          // Check if muted or power off before speaking
          const busState = VoiceBus.getState();
          if (!busState.mute && !isMutedRef.current && busState.power) {
            speechSynthesis.speak(utterance);
          } else {
            resolve();
          }
        });
      } else if (step.type === "word" && step.w) {
        // Legacy word-by-word support for backward compatibility
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(step.w);
          utteranceRef.current = utterance;
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          
          // Apply prosody parameters from the plan, combining with base accent config
          const baseRate = state.accentConfig.rate || 1.0;
          const basePitch = state.accentConfig.pitch || 1.0;
          utterance.rate = step.rate !== undefined ? Math.max(0.1, Math.min(10, step.rate * baseRate)) : baseRate;
          utterance.pitch = step.pitch !== undefined ? Math.max(0, Math.min(2, step.pitch * basePitch)) : basePitch;
          utterance.volume = step.volume !== undefined ? Math.max(0, Math.min(1, step.volume)) : 1.0;
          
          utterance.onend = () => {
            resolve();
          };
          
          utterance.onerror = (event: any) => {
            // Don't log error if it's due to cancellation and we're muted or cancelled
            if (!((event.error === 'canceled' || event.error === 'interrupted') && (isMutedRef.current || isCancelledRef.current))) {
              console.error("Error speaking word:", step.w, event);
            }
            // Stop execution on error to prevent stack overflow
            isCancelledRef.current = true;
            resolve();
          };
          
          // Check if muted or power off before speaking
          const busState = VoiceBus.getState();
          if (!busState.mute && !isMutedRef.current && busState.power) {
            speechSynthesis.speak(utterance);
          } else {
            resolve();
          }
        });
      } else if (step.type === "pause" && step.ms) {
        // Add a pause
        await new Promise(resolve => setTimeout(resolve, step.ms));
      }
    }
    
    console.log("[VoiceSynthesis] Prosody plan execution completed");
    
    // Clear safety timeout
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // Reset all flags
    isExecutingProsodyRef.current = false;
    isSpeakingRef.current = false;
    VoiceBus.setSpeaking(false);
    Voice.speaking(false); // Notify Voice controller we're done speaking
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, [state.accentConfig]);

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
      isSpeakingRef.current = true;
      VoiceBus.setSpeaking(true);
      Voice.speaking(true); // Notify Voice controller we're speaking
      setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      VoiceBus.setSpeaking(false);
      Voice.speaking(false); // Notify Voice controller we're done speaking
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event.error);
      isSpeakingRef.current = false;
      VoiceBus.setSpeaking(false);
      Voice.speaking(false); // Notify Voice controller on error
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      
      // For testing environments, simulate successful speech
      if (event.error === "synthesis-failed" && voices.length === 0) {
        console.log("Simulating speech for testing environment");
        VoiceBus.setSpeaking(true);
        Voice.speaking(true); // Start simulated speech
        setState(prev => ({ ...prev, isPlaying: true, currentUtterance: text }));
        setTimeout(() => {
          VoiceBus.setSpeaking(false);
          Voice.speaking(false); // End simulated speech
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

  // Update last human speech time
  const updateLastHumanSpeech = useCallback(() => {
    const now = Date.now();
    setState(prev => ({ ...prev, lastHumanSpeechTime: now }));
  }, []);

  // Set mute state
  const setMuted = useCallback((muted: boolean) => {
    // Guard against same state to prevent recursion
    const busState = VoiceBus.getState();
    if (busState.mute === muted) return;
    
    // Update ref immediately
    isMutedRef.current = muted;
    VoiceBus.setMute(muted);
    
    // If muting, stop any ongoing speech immediately
    if (muted) {
      cancelSpeak();
      isCancelledRef.current = true;
      isSpeakingRef.current = false;
      setState(prev => ({ ...prev, isMuted: muted, isPlaying: false, currentUtterance: "" }));
    } else {
      setState(prev => ({ ...prev, isMuted: muted }));
    }
  }, []);

  const setPower = useCallback((power: boolean) => {
    // Guard against same state to prevent recursion
    const busState = VoiceBus.getState();
    if (busState.power === power) return;
    
    VoiceBus.setPower(power);
    if (!power) {
      // Turning off power, stop everything
      cancelSpeak();
      isCancelledRef.current = true;
      isSpeakingRef.current = false;
      setState(prev => ({ 
        ...prev, 
        isPlaying: false,
        currentUtterance: "",
        isEnabled: false
      }));
    }
  }, []);

  // Set whether human speech is required before speaking
  const setRequiresHumanSpeech = useCallback((required: boolean) => {
    setState(prev => ({ ...prev, requiresHumanSpeech: required }));
  }, []);

  // Add disable function
  const disable = useCallback(() => {
    // Only cancel if there's something to cancel
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
    }
    isEnabledRef.current = false;
    setState(prev => ({ ...prev, isEnabled: false, isPlaying: false, currentUtterance: "" }));
    toast({
      title: "Voice Disabled",
      description: "Speech synthesis has been disabled.",
    });
  }, [toast]);

  // Main speak function with CVE integration
  const speak = useCallback(async (text: string, forceSpeak: boolean = false) => {
    // Check Voice controller mode first
    const voiceMode = Voice.getMode();
    if (voiceMode === 'KILLED') {
      console.error("[VoiceSynthesis] Voice is KILLED - cannot speak");
      return;
    }
    
    if (voiceMode === 'MUTED' && !forceSpeak) {
      console.log("[VoiceSynthesis] Speech blocked: Voice is MUTED");
      return;
    }
    
    // Hard gates - check power and mute first
    const busState = VoiceBus.getState();
    if (!busState.power) {
      console.error("[VoiceSynthesis] Power is OFF - cannot speak");
      return;
    }
    
    if ((busState.mute || state.isMuted) && !forceSpeak) {
      console.log("[VoiceSynthesis] Speech blocked: Muted");
      return;
    }

    // Check if already speaking or executing prosody to prevent overlaps
    if (isSpeakingRef.current || isExecutingProsodyRef.current) {
      console.log("[VoiceSynthesis] Speech blocked: Already speaking or executing");
      return;
    }

    // Check if human speech is required and not detected
    if (state.requiresHumanSpeech && !forceSpeak) {
      const timeSinceHumanSpeech = Date.now() - state.lastHumanSpeechTime;
      if (state.lastHumanSpeechTime === 0 || timeSinceHumanSpeech > 30000) {
        // No human speech detected or too long ago (30 seconds)
        console.log("[VoiceSynthesis] Speech blocked: Waiting for human speech");
        return;
      }
    }
    
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
          setTimeout(() => speak(text, forceSpeak), 100);
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

    // Stop any ongoing speech only if necessary
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
    }
    isCancelledRef.current = false;
    isSpeakingRef.current = true; // Set speaking flag immediately
    VoiceBus.setSpeaking(true);
    Voice.speaking(true); // Notify Voice controller we're starting to speak

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
          rate: state.accentConfig.rate,
          pitch: state.accentConfig.pitch,
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
      isSpeakingRef.current = false; // Reset on error
      
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
  }, [state.isEnabled, state.isMuted, state.requiresHumanSpeech, state.lastHumanSpeechTime, state.accentConfig, executeProsodyPlan, fallbackLocalSynthesis, toast, enable]);

  const stop = useCallback(() => {
    cancelSpeak();
    isCancelledRef.current = true;
    isExecutingProsodyRef.current = false;
    isSpeakingRef.current = false;
    
    // Clear safety timeout
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    Voice.speaking(false); // Notify Voice controller we stopped
    setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
  }, []);

  const test = useCallback(() => {
    speak("Hello, I'm Chango. How can I help you today?", true);
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
      speak(lastUtteranceRef.current, true);
    }
  }, [speak]);

  // Check if currently speaking
  const isSpeaking = useCallback(() => {
    return isSpeakingRef.current || state.isPlaying;
  }, [state.isPlaying]);

  // Subscribe to VoiceBus state changes
  useEffect(() => {
    const unsubscribe = VoiceBus.subscribe((busState) => {
      // If power turned off while speaking, stop immediately
      if (!busState.power && isSpeakingRef.current) {
        cancelSpeak();
        isCancelledRef.current = true;
        isSpeakingRef.current = false;
        setState(prev => ({ 
          ...prev, 
          isPlaying: false,
          currentUtterance: "",
          isEnabled: false
        }));
      }
      
      // If muted while speaking, stop immediately
      if (busState.mute && isSpeakingRef.current) {
        cancelSpeak();
        isCancelledRef.current = true;
        isSpeakingRef.current = false;
        setState(prev => ({ 
          ...prev, 
          isPlaying: false,
          currentUtterance: "",
          isMuted: true
        }));
      }
    });
    
    return unsubscribe;
  }, []);

  return {
    ...state,
    enable,
    disable,
    speak,
    stop,
    test,
    applyAccent,
    repeatWithAccent,
    isSpeaking,
    setMuted,
    setPower,
    setRequiresHumanSpeech,
    updateLastHumanSpeech,
  };
}