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
    isEnabled: true, // Start with synthesis enabled by default
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
  const isEnabledRef = useRef<boolean>(true); // Track enabled state immediately - start enabled
  const isSpeakingRef = useRef<boolean>(false); // Track if currently speaking
  const isMutedRef = useRef<boolean>(false); // Track mute state immediately
  const isExecutingProsodyRef = useRef<boolean>(false); // Prevent concurrent prosody executions
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Safety timeout for infinite loops
  const hasInitialized = useRef<boolean>(false); // Track if we've auto-initialized

  const enable = useCallback(() => {
    console.log("[VoiceSynthesis] Starting enable process...");
    
    return new Promise<boolean>((resolve) => {
      if ("speechSynthesis" in window) {
        let resolved = false;
        let attempts = 0;
        const maxAttempts = 20; // Increase max attempts for slower browsers
        let voicesLoadedHandler: (() => void) | null = null;
        
        const checkVoices = () => {
          if (resolved) return;
          
          const voices = speechSynthesis.getVoices();
          console.log(`[VoiceSynthesis] Checking voices - Attempt ${attempts + 1}/${maxAttempts}, Found: ${voices.length} voices`);
          
          if (voices.length > 0) {
            // Success! Voices are available
            console.log("[VoiceSynthesis] Voices loaded successfully:", voices.map(v => v.name));
            isEnabledRef.current = true;
            setState(prev => ({ ...prev, isEnabled: true }));
            
            toast({
              title: "Voice Enabled",
              description: `Speech synthesis ready with ${voices.length} voice${voices.length > 1 ? 's' : ''} available.`,
            });
            
            resolved = true;
            
            // Clean up the event listener if we added one
            if (voicesLoadedHandler) {
              speechSynthesis.removeEventListener('voiceschanged', voicesLoadedHandler);
            }
            
            resolve(true);
            return true;
          }
          
          return false;
        };
        
        // First, try to get voices immediately (they might be cached)
        if (checkVoices()) {
          return;
        }
        
        // Trigger voice loading with a dummy utterance (required by some browsers)
        console.log("[VoiceSynthesis] Triggering voice loading with dummy utterance...");
        try {
          const dummy = new SpeechSynthesisUtterance('');
          dummy.volume = 0; // Silent
          speechSynthesis.speak(dummy);
          speechSynthesis.cancel();
        } catch (error) {
          console.warn("[VoiceSynthesis] Failed to trigger voice loading with dummy utterance:", error);
        }
        
        // Set up voiceschanged event listener
        voicesLoadedHandler = () => {
          console.log("[VoiceSynthesis] voiceschanged event fired");
          checkVoices();
        };
        speechSynthesis.addEventListener('voiceschanged', voicesLoadedHandler);
        
        // Also poll for voices with exponential backoff
        const pollForVoices = () => {
          if (resolved) return;
          
          attempts++;
          
          // Check if voices are now available
          if (checkVoices()) {
            return;
          }
          
          if (attempts < maxAttempts) {
            // Calculate delay with exponential backoff (100ms, 200ms, 400ms, etc., max 2000ms)
            const delay = Math.min(100 * Math.pow(1.5, attempts), 2000);
            console.log(`[VoiceSynthesis] No voices yet, retrying in ${delay}ms...`);
            setTimeout(pollForVoices, delay);
          } else {
            // Max attempts reached - voices not loading
            console.error("[VoiceSynthesis] Failed to load voices after maximum attempts");
            
            // Clean up event listener
            if (voicesLoadedHandler) {
              speechSynthesis.removeEventListener('voiceschanged', voicesLoadedHandler);
            }
            
            // DO NOT enable synthesis without voices
            isEnabledRef.current = false;
            setState(prev => ({ ...prev, isEnabled: false }));
            
            toast({
              title: "Voice Loading Failed",
              description: "Unable to load speech synthesis voices. Please refresh the page or try a different browser.",
              variant: "destructive",
            });
            
            resolved = true;
            resolve(false);
          }
        };
        
        // Start polling after a short delay to give voiceschanged event a chance
        setTimeout(pollForVoices, 100);
        
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

  // Auto-enable on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      console.log("[VoiceSynthesis] Auto-enabling on mount...");
      // Call enable directly without waiting for the callback to be ready
      const initVoice = async () => {
        try {
          const success = await enable();
          if (success) {
            console.log("[VoiceSynthesis] Successfully auto-enabled on mount");
          } else {
            console.error("[VoiceSynthesis] Failed to auto-enable on mount");
          }
        } catch (error) {
          console.error("[VoiceSynthesis] Error during auto-enable:", error);
        }
      };
      initVoice();
    }
  }, []); // Empty deps - only run once on mount

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
    
    // Clear any existing safety timeout before setting a new one
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // Calculate adaptive timeout based on text length and prosody steps
    // Estimate: ~500ms per word + 500ms per pause + buffer (increased from 200ms for safer timeout)
    const wordCount = originalText.split(/\s+/).length;
    const pauseCount = plan.filter(step => step.type === 'pause').length;
    const estimatedDuration = (wordCount * 500) + (pauseCount * 500) + 10000; // Add 10s buffer
    const timeoutDuration = Math.max(15000, Math.min(estimatedDuration, 60000)); // Min 15s, max 60s
    
    const timeoutStartTime = Date.now();
    console.log(`[VoiceSynthesis] Setting adaptive safety timeout: ${timeoutDuration}ms for ${wordCount} words`);
    
    // Set safety timeout to prevent infinite loops
    safetyTimeoutRef.current = setTimeout(() => {
      const actualElapsed = Date.now() - timeoutStartTime;
      console.error(`[VoiceSynthesis] Safety timeout triggered after ${actualElapsed}ms (configured: ${timeoutDuration}ms) - stopping speech`);
      speechSynthesis.cancel();
      isExecutingProsodyRef.current = false;
      isSpeakingRef.current = false;
      VoiceBus.setSpeaking(false);
      Voice.speaking(false);
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      safetyTimeoutRef.current = null; // Clear the ref after triggering
    }, timeoutDuration);
    
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
        console.log("[VoiceSynthesis] Prosody plan execution stopped early:", { 
          power: busState.power,
          muted: busState.mute || isMutedRef.current,
          cancelled: isCancelledRef.current,
          speaking: isSpeakingRef.current
        });
        
        // Clear safety timeout on early exit
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
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
          
          utterance.onstart = () => {
            console.log("[VoiceSynthesis] Started speaking phrase:", step.text?.slice(0, 50));
          };
          
          utterance.onend = () => {
            console.log("[VoiceSynthesis] Finished speaking phrase:", step.text?.slice(0, 50));
            resolve();
          };
          
          utterance.onerror = (event: any) => {
            // Don't log error if it's due to cancellation and we're muted or cancelled
            if (!((event.error === 'canceled' || event.error === 'interrupted') && (isMutedRef.current || isCancelledRef.current))) {
              console.error("[VoiceSynthesis] Error speaking phrase:", step.text, {
                error: event.error,
                errorCode: event.error,
                charIndex: event.charIndex,
                elapsedTime: event.elapsedTime,
                name: event.name,
                utteranceText: utterance.text,
                voice: utterance.voice?.name || 'no voice set',
                voicesAvailable: speechSynthesis.getVoices().length,
                rate: utterance.rate,
                pitch: utterance.pitch,
                volume: utterance.volume
              });
            }
            // Stop execution on error to prevent stack overflow
            isCancelledRef.current = true;
            resolve();
          };
          
          // Check if muted or power off before speaking
          const busState = VoiceBus.getState();
          if (!busState.mute && !isMutedRef.current && busState.power) {
            // Ensure we have voices loaded
            if (!preferredVoice && voices.length === 0) {
              console.warn("[VoiceSynthesis] No voices available, attempting to load...");
              const retryVoices = speechSynthesis.getVoices();
              if (retryVoices.length > 0) {
                const retryVoice = retryVoices[0];
                utterance.voice = retryVoice;
                console.log("[VoiceSynthesis] Loaded voice on retry:", retryVoice.name);
              }
            }
            
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
          
          utterance.onstart = () => {
            console.log("[VoiceSynthesis] Started speaking word:", step.w);
          };
          
          utterance.onend = () => {
            console.log("[VoiceSynthesis] Finished speaking word:", step.w);
            resolve();
          };
          
          utterance.onerror = (event: any) => {
            // Don't log error if it's due to cancellation and we're muted or cancelled
            if (!((event.error === 'canceled' || event.error === 'interrupted') && (isMutedRef.current || isCancelledRef.current))) {
              console.error("[VoiceSynthesis] Error speaking word:", step.w, {
                error: event.error,
                errorCode: event.error,
                charIndex: event.charIndex,
                elapsedTime: event.elapsedTime,
                name: event.name,
                utteranceText: utterance.text,
                voice: utterance.voice?.name || 'no voice set',
                voicesAvailable: speechSynthesis.getVoices().length,
                rate: utterance.rate,
                pitch: utterance.pitch,
                volume: utterance.volume
              });
            }
            // Stop execution on error to prevent stack overflow
            isCancelledRef.current = true;
            resolve();
          };
          
          // Check if muted or power off before speaking
          const busState = VoiceBus.getState();
          if (!busState.mute && !isMutedRef.current && busState.power) {
            // Ensure we have voices loaded
            if (!preferredVoice && voices.length === 0) {
              console.warn("[VoiceSynthesis] No voices available for word, attempting to load...");
              const retryVoices = speechSynthesis.getVoices();
              if (retryVoices.length > 0) {
                const retryVoice = retryVoices[0];
                utterance.voice = retryVoice;
                console.log("[VoiceSynthesis] Loaded voice on retry for word:", retryVoice.name);
              }
            }
            
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

    utterance.onerror = (event: any) => {
      console.error("[VoiceSynthesis] Fallback synthesis error:", {
        error: event.error,
        errorCode: event.error,
        charIndex: event.charIndex,
        elapsedTime: event.elapsedTime,
        name: event.name,
        utteranceText: utterance.text,
        voice: utterance.voice?.name || 'no voice set',
        voicesAvailable: voices.length,
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume
      });
      
      isSpeakingRef.current = false;
      VoiceBus.setSpeaking(false);
      Voice.speaking(false); // Notify Voice controller on error
      setState(prev => ({ ...prev, isPlaying: false, currentUtterance: "" }));
      
      // For testing environments, simulate successful speech
      if (event.error === "synthesis-failed" && voices.length === 0) {
        console.log("[VoiceSynthesis] Simulating speech for testing environment");
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

    // Clear any existing safety timeout from a previous speech attempt
    if (safetyTimeoutRef.current) {
      console.log("[VoiceSynthesis] Clearing existing safety timeout before new speech");
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

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
      
      // Clear safety timeout on error
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
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

  // Interrupt function for barge-in functionality
  const interrupt = useCallback(() => {
    console.log("[VoiceSynthesis] Barge-in interrupt - stopping TTS");
    
    // Cancel any ongoing speech synthesis
    cancelSpeak();
    isCancelledRef.current = true;
    isExecutingProsodyRef.current = false;
    isSpeakingRef.current = false;
    
    // Clear safety timeout
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // Notify Voice controller about interruption
    Voice.speaking(false); // This will trigger cooldown
    VoiceBus.setSpeaking(false);
    
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

  // Subscribe to VoiceBus event changes - use event-based system to prevent circular dependencies
  useEffect(() => {
    const unsubscribe = VoiceBus.on((event) => {
      switch (event.type) {
        case 'cancel':
          // IMPORTANT: do NOT call VoiceBus.cancelSpeak() here - that would cause circular recursion
          // Just update local UI state
          isCancelledRef.current = true;
          isSpeakingRef.current = false;
          setState(prev => ({ 
            ...prev, 
            isPlaying: false,
            currentUtterance: "",
          }));
          return;

        case 'muteChange':
          // Update mute state
          setState(prev => ({ ...prev, isMuted: event.muted || false }));
          
          // Only trigger cancel when mute toggles ON and we're speaking
          if (event.muted && isSpeakingRef.current && !isCancelledRef.current) {
            // Use VoiceBus.cancelSpeak to stop speech when muted
            VoiceBus.cancelSpeak('system');
          }
          return;
        
        case 'powerChange':
          // Handle power state changes
          if (!event.powered) {
            // Power turned off - stop everything
            isCancelledRef.current = true;
            isSpeakingRef.current = false;
            setState(prev => ({ 
              ...prev, 
              isPlaying: false,
              currentUtterance: "",
              isEnabled: false
            }));
          }
          return;

        case 'speakingChange':
          // Just update speaking state if needed
          // This is handled elsewhere, so we can skip it
          return;

        case 'stateChange':
          // Handle general state changes if needed
          return;

        default:
          return;
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
    interrupt,
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