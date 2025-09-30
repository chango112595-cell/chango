import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { VoiceBus } from "@/lib/voiceBus";
import { Voice } from "@/lib/voiceController";

interface VADConfig {
  minDb: number; // Minimum decibel level to consider as speech
  minMs: number; // Minimum duration in ms to consider as valid speech
  debounceMs: number; // Debounce time after speech ends
}

interface VADState {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  status: string;
}

interface VADCallbacks {
  onSpeech?: () => void;
  onSilence?: () => void;
  onLevelUpdate?: (level: number) => void;
}

export function useVAD(callbacks: VADCallbacks = {}) {
  const [state, setState] = useState<VADState>({
    isListening: false,
    isSpeaking: false,
    audioLevel: 0,
    status: "VAD inactive"
  });

  const { toast } = useToast();
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const silenceStartTimeRef = useRef(0);
  const lastSpeechEndRef = useRef(0);
  const isProcessingRef = useRef(false); // Flag to prevent re-entrant processing

  // VAD configuration
  const config: VADConfig = {
    minDb: -45, // Minimum dB level for speech detection
    minMs: 280, // Minimum speech duration
    debounceMs: 500 // Debounce after speech ends
  };

  // Analyze audio levels
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatFrequencyData(dataArray);

    // Calculate average decibel level
    let sum = 0;
    let count = 0;
    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > -Infinity) {
        sum += dataArray[i];
        count++;
      }
    }
    const avgDb = count > 0 ? sum / count : -Infinity;
    
    // Normalize audio level for display (0-1 range)
    const normalizedLevel = Math.max(0, Math.min(1, (avgDb + 100) / 100));
    
    // Update level callback
    if (callbacks.onLevelUpdate) {
      callbacks.onLevelUpdate(normalizedLevel);
    }

    const now = Date.now();
    const isSpeechDetected = avgDb > config.minDb;

    // Check Voice controller mode before processing speech events
    const voiceMode = Voice.getMode();
    if (voiceMode !== 'ACTIVE') {
      // Don't process if not active
      return;
    }
    
    // Check if power is on before processing speech events
    const busState = VoiceBus.getState();
    if (!busState.power) {
      // Don't process if power is off
      return;
    }
    
    // Handle speech detection state machine
    if (isSpeechDetected && !isSpeakingRef.current) {
      // Speech started
      if (speechStartTimeRef.current === 0) {
        speechStartTimeRef.current = now;
      } else if (now - speechStartTimeRef.current > config.minMs) {
        // Confirmed speech after minimum duration
        isSpeakingRef.current = true;
        lastSpeechEndRef.current = 0;
        setState(prev => ({ 
          ...prev, 
          isSpeaking: true, 
          audioLevel: normalizedLevel,
          status: "Speech detected"
        }));
        if (callbacks.onSpeech) {
          callbacks.onSpeech();
        }
      }
    } else if (!isSpeechDetected && isSpeakingRef.current) {
      // Speech might have ended
      if (silenceStartTimeRef.current === 0) {
        silenceStartTimeRef.current = now;
      } else if (now - silenceStartTimeRef.current > config.debounceMs) {
        // Confirmed silence after debounce
        isSpeakingRef.current = false;
        speechStartTimeRef.current = 0;
        silenceStartTimeRef.current = 0;
        lastSpeechEndRef.current = now;
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false, 
          audioLevel: normalizedLevel,
          status: "Silence detected"
        }));
        if (callbacks.onSilence) {
          callbacks.onSilence();
        }
      }
    } else if (isSpeechDetected && isSpeakingRef.current) {
      // Continued speech, reset silence timer
      silenceStartTimeRef.current = 0;
      setState(prev => ({ 
        ...prev, 
        audioLevel: normalizedLevel
      }));
    } else if (!isSpeechDetected && !isSpeakingRef.current) {
      // Continued silence, reset speech timer
      speechStartTimeRef.current = 0;
      setState(prev => ({ 
        ...prev, 
        audioLevel: normalizedLevel
      }));
    }

    // Continue analysis
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [config.minDb, config.minMs, config.debounceMs, callbacks]);

  // Start VAD
  const startListening = useCallback(async () => {
    // Guard against re-entrant calls
    if (state.isListening || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    // Check Voice controller mode
    const voiceMode = Voice.getMode();
    if (voiceMode === 'KILLED' || voiceMode === 'MUTED') {
      console.error(`[useVAD] Cannot start - Voice is ${voiceMode}`);
      toast({
        title: "Cannot Start VAD",
        description: `Voice is ${voiceMode}. ${voiceMode === 'KILLED' ? 'Revive voice first.' : 'Unmute voice first.'}`,
        variant: "destructive",
      });
      isProcessingRef.current = false;
      return;
    }
    
    // Check if power is on
    const busState = VoiceBus.getState();
    if (!busState.power) {
      console.error("[useVAD] Cannot start - power is OFF");
      toast({
        title: "Cannot Start VAD",
        description: "Voice power is OFF. Turn on power first.",
        variant: "destructive",
      });
      isProcessingRef.current = false;
      return;
    }
    
    try {
      // Use Voice controller to manage mic access
      await Voice.startListening();
      
      // Get the media stream from Voice controller
      const stream = Voice.getMediaStream();
      if (!stream) {
        throw new Error("Voice controller failed to provide media stream");
      }
      
      streamRef.current = stream;

      // Set up Web Audio API for analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      source.connect(analyserRef.current);

      // Reset state
      isSpeakingRef.current = false;
      speechStartTimeRef.current = 0;
      silenceStartTimeRef.current = 0;

      setState({
        isListening: true,
        isSpeaking: false,
        audioLevel: 0,
        status: "VAD active - listening..."
      });

      // Start analyzing
      analyzeAudio();

      toast({
        title: "VAD Enabled",
        description: "Voice Activity Detection is now active",
      });
      
      isProcessingRef.current = false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setState(prev => ({ 
        ...prev, 
        status: `Microphone error: ${errorMessage}`
      }));
      
      toast({
        title: "VAD Failed",
        description: `Could not access microphone: ${errorMessage}`,
        variant: "destructive",
      });
      isProcessingRef.current = false;
    }
  }, [analyzeAudio, toast, state.isListening]);

  // Stop VAD
  const stopListening = useCallback(() => {
    // Guard against re-entrant calls
    if (!state.isListening || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect and close audio nodes properly
    if (analyserRef.current && audioContextRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Don't stop the stream directly - let Voice controller manage it
    streamRef.current = null;

    // Reset refs
    analyserRef.current = null;
    isSpeakingRef.current = false;
    speechStartTimeRef.current = 0;
    silenceStartTimeRef.current = 0;

    setState({
      isListening: false,
      isSpeaking: false,
      audioLevel: 0,
      status: "VAD inactive"
    });
    
    isProcessingRef.current = false;
  }, [state.isListening]);

  // Check if human spoke recently (for anti-loop guard)
  const hasRecentHumanSpeech = useCallback(() => {
    if (!lastSpeechEndRef.current) return false;
    const timeSinceSpeech = Date.now() - lastSpeechEndRef.current;
    return timeSinceSpeech < 5000; // Within 5 seconds
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isListening) {
        stopListening();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    startListening,
    stopListening,
    hasRecentHumanSpeech,
  };
}