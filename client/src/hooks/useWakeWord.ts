import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { VoiceBus, cancelSpeak } from "@/lib/voiceBus";
import { Voice } from "@/lib/voiceController";
import { WebSpeechSTT } from "@/lib/webSpeechSTT";
import { ConversationOrchestrator } from "@/lib/conversationOrchestrator";
import { useConversation } from "@/lib/conversationContext";

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
  const { addUserMessage, addChangoMessage } = useConversation();
  const recognitionRef = useRef<any>(null);
  const sttRef = useRef<WebSpeechSTT | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const commandBufferRef = useRef<string>("");
  const isStoppingRef = useRef<boolean>(false); // Guard to prevent multiple stop calls
  const commandCaptureRef = useRef<boolean>(false); // Track when command STT is running
  const mountedRef = useRef<boolean>(true); // Track component mounted state

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
  const handleSpeechResult = useCallback(async (event: any) => {
    // Check Voice controller state first
    const voiceMode = Voice.getMode();
    console.log('[useWakeWord] Handling speech result in mode:', voiceMode);
    
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

    // In WAKE mode, check for wake word FIRST before any other filtering
    if (voiceMode === 'WAKE') {
      // Don't check for wake word while TTS is speaking to prevent self-wake
      if (Voice.isSpeaking()) {
        console.log('[useWakeWord] Suppressing wake word check during TTS');
        return;
      }
      
      const wakeWordDetected = transcript.includes(state.wakeWord.toLowerCase());
      console.log('[useWakeWord] Checking for wake word in transcript:', { wakeWordDetected, transcript, wakeWord: state.wakeWord });
      
      if (wakeWordDetected) {
        console.log('[useWakeWord] Wake word detected in WAKE mode! Starting STT...');
        
        // Set flag to prevent continuous recognizer from restarting
        commandCaptureRef.current = true;
        
        // Stop continuous recognizer and wait for it to fully stop
        if (recognitionRef.current && !isStoppingRef.current) {
          isStoppingRef.current = true;
          console.log('[useWakeWord] Stopping continuous recognizer before starting command STT');
          
          // Set up promise to wait for onend
          const stopPromise = new Promise<void>((resolve) => {
            // When stopping continuous recognizer, DO NOT call original onend
            recognitionRef.current.onend = (event: any) => {
              console.log('[useWakeWord] Continuous recognizer stopped for command capture');
              isStoppingRef.current = false;
              resolve();
              // DO NOT call original onend here - it would restart the recognizer
            };
          });
          
          try {
            recognitionRef.current.stop();
            await stopPromise; // Wait for stop to complete
            console.log('[useWakeWord] Ready to start command STT');
          } catch (e) {
            console.log('[useWakeWord] Error stopping recognizer:', e);
            isStoppingRef.current = false;
          }
        }
        
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
            
            // Clear command capture flag
            commandCaptureRef.current = false;
            
            // Restart continuous recognizer after delay
            setTimeout(() => {
              if (mountedRef.current && recognitionRef.current && state.isEnabled) {
                try {
                  recognitionRef.current.start();
                  console.log('[useWakeWord] Continuous recognizer restarted after command');
                } catch (error) {
                  console.error('[useWakeWord] Failed to restart continuous recognizer:', error);
                }
              }
            }, 300);
          });
          
          sttRef.current.onerror((error: any) => {
            console.error('[useWakeWord] STT error:', error);
            
            // Clear command capture flag on error too
            commandCaptureRef.current = false;
            
            // Restart continuous recognizer after delay
            setTimeout(() => {
              if (mountedRef.current && recognitionRef.current && state.isEnabled) {
                try {
                  recognitionRef.current.start();
                  console.log('[useWakeWord] Continuous recognizer restarted after error');
                } catch (error) {
                  console.error('[useWakeWord] Failed to restart continuous recognizer:', error);
                }
              }
            }, 300);
            
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
        // Wake word was detected and processed, exit early
        return;
      }
      
      // Only ignore non-wake-word input in WAKE mode
      if (Voice.shouldIgnoreInput()) {
        console.log('[useWakeWord] Voice shouldIgnoreInput for non-wake-word input in WAKE mode');
        return;
      }
      // Not wake word in WAKE mode, ignore
      return;
    }
    
    // For non-WAKE modes, check shouldIgnoreInput normally
    if (Voice.shouldIgnoreInput()) {
      console.log('[useWakeWord] Voice shouldIgnoreInput, ignoring result in mode:', voiceMode);
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
      // Use the ConversationOrchestrator for unified Q&A flow
      console.log('[useWakeWord] Using ConversationOrchestrator for command:', command);
      
      const result = await ConversationOrchestrator.processConversation(command, {
        addUserMessage,
        addChangoMessage,
        speak,
        showToast: (title, description, variant) => {
          toast({
            title,
            description,
            variant: variant as any,
          });
        }
      });

      if (result.success && result.response) {
        console.log('[useWakeWord] ConversationOrchestrator response:', result.response);
        setState(prev => ({ ...prev, lastResponse: result.response || '' }));
      } else {
        console.error('[useWakeWord] ConversationOrchestrator failed:', result.error);
        if (result.error && !result.error.includes('powered off')) {
          toast({
            title: "Command Processing Failed",
            description: result.error || "Failed to process your command. Please try again.",
            variant: "destructive",
          });
        }
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
  }, [state.isProcessing, toast, speak, addUserMessage, addChangoMessage]);

  // End the current session
  const endSession = useCallback(() => {
    console.log('[useWakeWord] Ending session, starting cooldown');
    
    commandBufferRef.current = "";
    
    // Clear command capture flag
    commandCaptureRef.current = false;
    
    // Stop STT if running and clear reference
    if (sttRef.current) {
      console.log('[useWakeWord] Stopping and clearing command STT');
      sttRef.current.stop();
      sttRef.current = null; // Clear reference so continuous recognizer can restart
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
    cooldownRef.current = setTimeout(async () => {
      setState(prev => ({ ...prev, inCooldown: false }));
      console.log('[useWakeWord] Cooldown ended');
      
      // Wait for TTS to finish plus buffer time before restarting
      const waitForTTS = async () => {
        // Wait for speaking to finish
        while (Voice.isSpeaking()) {
          console.log('[useWakeWord] Waiting for TTS to finish before restart...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Add buffer time after TTS ends
        console.log('[useWakeWord] TTS finished, adding buffer time...');
        await new Promise(resolve => setTimeout(resolve, 800));
      };
      
      await waitForTTS();
      
      // Restart continuous recognizer
      if (mountedRef.current && state.isEnabled && recognitionRef.current) {
        console.log('[useWakeWord] Restarting continuous recognizer after session end');
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('[useWakeWord] Failed to restart continuous recognizer:', error);
        }
      }
    }, config.cooldownMs || 2500);
  }, [config.cooldownMs, state.isEnabled]);

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
    
    // Don't auto-restart if command capture is active
    if (commandCaptureRef.current) {
      console.log('[useWakeWord] Suppressing auto-restart during command capture');
      return;
    }
    
    // Don't auto-restart if we're stopping intentionally or command STT is active
    if (isStoppingRef.current || sttRef.current) {
      console.log('[useWakeWord] Suppressing auto-restart (stopping or command active)');
      return;
    }
    
    // Only restart if still enabled and no active STT
    if (state.isEnabled && recognitionRef.current) {
      console.log('[useWakeWord] Restarting recognition after onend');
      setTimeout(() => {
        // Double-check conditions before restart
        if (state.isEnabled && recognitionRef.current && !isStoppingRef.current && !sttRef.current && !commandCaptureRef.current) {
          try {
            recognitionRef.current.start();
            console.log('[useWakeWord] Recognition restarted');
          } catch (error) {
            console.error('[useWakeWord] Failed to restart recognition:', error);
          }
        }
      }, 500);
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
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
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