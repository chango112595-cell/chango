import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { VoiceBus, cancelSpeak } from "@/lib/voiceBus";
import { Voice } from "@/lib/voiceController";
import { WebSpeechSTT } from "@/lib/webSpeechSTT";

interface WakeWordConfig {
  wakeWord?: string;
  cooldownMs?: number;
  maxUtteranceMs?: number;
  silenceTimeoutMs?: number;
  minConfidence?: number;
}

interface WakeWordState {
  isEnabled: boolean;
  isListening: boolean;
  isProcessing: boolean;
  inCooldown: boolean;
  sessionActive: boolean;
  lastCommand: string;
  lastResponse: string;
  wakeWord: string;
}

export function useWakeWord(config: WakeWordConfig = {}) {
  const [state, setState] = useState<WakeWordState>({
    isEnabled: false,
    isListening: false,
    isProcessing: false,
    inCooldown: false,
    sessionActive: false,
    lastCommand: "",
    lastResponse: "",
    wakeWord: config.wakeWord || "chango"
  });

  const { toast } = useToast();
  const { speak } = useVoiceSynthesis();
  const recognitionRef = useRef<any>(null);
  const sttRef = useRef<WebSpeechSTT | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const commandBufferRef = useRef<string>("");
  const isStoppingRef = useRef<boolean>(false); // Guard to prevent multiple stop calls

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    // Check Voice controller state first
    const voiceMode = Voice.getMode();
    if (voiceMode === 'KILLED') {
      console.error("[useWakeWord] Voice is KILLED - cannot initialize");
      return false;
    }
    
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.error("[useWakeWord] Speech recognition not supported");
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition",
        variant: "destructive",
      });
      return false;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => handleSpeechResult(event);
    recognition.onerror = (event: any) => handleSpeechError(event);
    recognition.onend = () => handleSpeechEnd();
    recognition.onstart = () => {
      console.log('[useWakeWord] Recognition started');
      setState(prev => ({ ...prev, isListening: true }));
    };

    recognitionRef.current = recognition;
    return true;
  }, [toast]);

  // Handle speech recognition results
  const handleSpeechResult = useCallback((event: any) => {
    // Check if input should be ignored first
    if (Voice.shouldIgnoreInput()) {
      console.log('[useWakeWord] Voice shouldIgnoreInput, ignoring result');
      return;
    }
    
    // Check Voice controller state
    const voiceMode = Voice.getMode();
    
    // Check if power is on
    const busState = VoiceBus.getState();
    if (!busState.power || !state.isEnabled) return;

    const resultIndex = event.resultIndex;
    const result = event.results[resultIndex];
    const transcript = result[0].transcript.toLowerCase().trim();
    const confidence = result[0].confidence || 0.7; // Default to 0.7 if not provided
    const isFinal = result.isFinal;

    console.log('[useWakeWord] Speech result:', { 
      transcript, 
      confidence,
      isFinal, 
      sessionActive: state.sessionActive,
      mode: voiceMode 
    });

    // Check confidence threshold
    if (config.minConfidence && confidence < (config.minConfidence || 0.6)) {
      console.log('[useWakeWord] Confidence too low:', confidence);
      return;
    }

    // Check if in cooldown
    if (state.inCooldown) {
      console.log('[useWakeWord] In cooldown, ignoring');
      return;
    }

    // In WAKE mode, only respond to wake word
    if (voiceMode === 'WAKE') {
      const wakeWordDetected = transcript.includes(state.wakeWord.toLowerCase());
      
      if (wakeWordDetected) {
        console.log('[useWakeWord] Wake word detected in WAKE mode! Starting STT...');
        
        // Notify Voice controller
        Voice.wakeWordHeard();
        
        // Extract command after wake word if present
        const wakeWordIndex = transcript.indexOf(state.wakeWord.toLowerCase());
        const afterWakeWord = transcript.substring(wakeWordIndex + state.wakeWord.length).trim();
        
        setState(prev => ({ ...prev, sessionActive: true }));
        
        // Initialize and start WebSpeechSTT for capturing the actual command
        if (!sttRef.current) {
          sttRef.current = new WebSpeechSTT();
          sttRef.current.setLangFromAccent('en-US');
          
          sttRef.current.onfinal((finalTranscript: string) => {
            console.log('[useWakeWord] STT captured:', finalTranscript);
            if (finalTranscript) {
              processCommand(finalTranscript);
            }
          });
          
          sttRef.current.onerror((error: any) => {
            console.error('[useWakeWord] STT error:', error);
            endSession();
          });
        }
        
        // If we already have command after wake word, process it
        if (afterWakeWord) {
          processCommand(afterWakeWord);
        } else {
          // Start STT to capture the command
          console.log('[useWakeWord] Starting STT to capture command...');
          sttRef.current.start();
          
          // Set timeout for STT
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            sttRef.current?.stop();
            endSession();
          }, config.maxUtteranceMs || 8000);
        }
      }
      // Ignore non-wake-word input in WAKE mode
      return;
    }

    // In ACTIVE mode, handle normally
    // Check for wake word to start session
    if (!state.sessionActive) {
      const wakeWordDetected = transcript.includes(state.wakeWord.toLowerCase());
      
      if (wakeWordDetected) {
        console.log('[useWakeWord] Wake word detected in ACTIVE mode!');
        
        // Extract command after wake word
        const wakeWordIndex = transcript.indexOf(state.wakeWord.toLowerCase());
        const afterWakeWord = transcript.substring(wakeWordIndex + state.wakeWord.length).trim();
        
        setState(prev => ({ ...prev, sessionActive: true }));
        commandBufferRef.current = afterWakeWord;
        
        // Start timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (commandBufferRef.current) {
            processCommand(commandBufferRef.current);
          } else {
            endSession();
          }
        }, config.maxUtteranceMs || 8000);
        
        // Process immediately if final and has command
        if (isFinal && afterWakeWord) {
          processCommand(afterWakeWord);
        }
      }
    } else {
      // In active session, accumulate command
      commandBufferRef.current = transcript;
      
      // Reset timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (commandBufferRef.current) {
          processCommand(commandBufferRef.current);
        } else {
          endSession();
        }
      }, config.silenceTimeoutMs || 1500);
      
      // Process if final
      if (isFinal && commandBufferRef.current) {
        processCommand(commandBufferRef.current);
      }
    }
  }, [state.isEnabled, state.inCooldown, state.sessionActive, state.wakeWord, config]);

  // Process the recognized command
  const processCommand = useCallback(async (command: string) => {
    if (!command || state.isProcessing) return;

    console.log('[useWakeWord] Processing command:', command);
    
    setState(prev => ({ 
      ...prev, 
      isProcessing: true,
      lastCommand: command
    }));

    // Clear timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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
            wakeWord: state.wakeWord,
            sessionId: Date.now().toString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`NLP API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.reply) {
        console.log('[useWakeWord] Got reply:', data.reply);
        setState(prev => ({ ...prev, lastResponse: data.reply }));
        
        // Force speak the reply using voice synthesis hook (bypass WAKE mode)
        speak(data.reply, true);
      }
      
    } catch (error) {
      console.error('[useWakeWord] Error processing command:', error);
      toast({
        title: "Command Processing Failed",
        description: "Failed to process your command. Please try again.",
        variant: "destructive",
      });
    } finally {
      endSession();
    }
  }, [state.isProcessing, state.wakeWord, toast, speak]);

  // End the current session
  const endSession = useCallback(() => {
    console.log('[useWakeWord] Ending session, starting cooldown');
    
    commandBufferRef.current = "";
    
    // Stop STT if running
    if (sttRef.current) {
      sttRef.current.stop();
    }
    
    // Clear timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      sessionActive: false,
      isProcessing: false,
      inCooldown: true
    }));
    
    // Start cooldown
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, inCooldown: false }));
      console.log('[useWakeWord] Cooldown ended');
    }, config.cooldownMs || 2500);
  }, [config.cooldownMs]);

  // Handle speech recognition errors
  const handleSpeechError = useCallback((event: any) => {
    console.error('[useWakeWord] Recognition error:', event.error);
    
    if (event.error === 'no-speech') {
      // Normal, just restart if enabled
      if (state.isEnabled && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Already started
          }
        }, 100);
      }
    } else if (event.error === 'audio-capture' || event.error === 'not-allowed') {
      setState(prev => ({ ...prev, isEnabled: false, isListening: false }));
      toast({
        title: "Microphone Access Denied",
        description: "Please enable microphone access to use wake word detection",
        variant: "destructive",
      });
    }
  }, [state.isEnabled, toast]);

  // Handle speech recognition end
  const handleSpeechEnd = useCallback(() => {
    console.log('[useWakeWord] Recognition ended');
    setState(prev => ({ ...prev, isListening: false }));
    
    // Restart if still enabled
    if (state.isEnabled && recognitionRef.current) {
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started
        }
      }, 100);
    }
  }, [state.isEnabled]);

  // Enable wake word detection
  const enable = useCallback(async () => {
    // Guard against multiple enable calls
    if (state.isEnabled) return false;
    
    // Check Voice controller state
    const voiceMode = Voice.getMode();
    if (voiceMode === 'KILLED' || voiceMode === 'MUTED') {
      console.error('[useWakeWord] Cannot enable - Voice is', voiceMode);
      toast({
        title: "Cannot Enable",
        description: `Voice is ${voiceMode}. ${voiceMode === 'KILLED' ? 'Revive voice first.' : 'Unmute voice first.'}`,
        variant: "destructive",
      });
      return false;
    }
    
    // Check if power is on
    const busState = VoiceBus.getState();
    if (!busState.power) {
      console.error("[useWakeWord] Cannot enable - power is OFF");
      toast({
        title: "Cannot Enable",
        description: "Voice power is OFF. Turn on power first.",
        variant: "destructive",
      });
      return false;
    }
    
    if (!initializeRecognition()) {
      return false;
    }

    try {
      // Ensure Voice controller is listening
      await Voice.startListening();
      
      // Use Voice controller's media stream if available
      const mediaStream = Voice.getMediaStream();
      if (!mediaStream) {
        console.warn('[useWakeWord] No media stream from Voice controller, will use browser SpeechRecognition');
      }
      
      await recognitionRef.current.start();
      setState(prev => ({ ...prev, isEnabled: true }));
      
      toast({
        title: "Wake Word Detection Enabled",
        description: `Say "${state.wakeWord}" to start a command`,
      });
      
      return true;
    } catch (error) {
      console.error('[useWakeWord] Failed to start recognition:', error);
      toast({
        title: "Failed to Enable",
        description: "Could not start wake word detection",
        variant: "destructive",
      });
      return false;
    }
  }, [state.wakeWord, initializeRecognition, toast]);

  // Disable wake word detection
  const disable = useCallback(() => {
    // Guard against multiple disable calls
    if (!state.isEnabled || isStoppingRef.current) return;
    
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    
    // Stop any ongoing speech
    cancelSpeak();
    
    // Clear all timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    
    setState(prev => ({ 
      ...prev, 
      isEnabled: false,
      isListening: false,
      sessionActive: false,
      isProcessing: false,
      inCooldown: false
    }));
    
    toast({
      title: "Wake Word Detection Disabled",
      description: "Voice commands are now disabled",
    });
    
    isStoppingRef.current = false;
  }, [toast, state.isEnabled]);

  // Set wake word
  const setWakeWord = useCallback((word: string) => {
    if (word && typeof word === 'string') {
      setState(prev => ({ ...prev, wakeWord: word.toLowerCase() }));
      console.log('[useWakeWord] Wake word updated to:', word);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isEnabled) {
        disable();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    enable,
    disable,
    setWakeWord,
  };
}