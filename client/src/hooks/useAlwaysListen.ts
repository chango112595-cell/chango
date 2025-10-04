/**
 * Always Listen Hook
 * Manages continuous listening with deferred mic initialization for iOS Safari
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { debugBus } from '../dev/debugBus';
import { voiceGate, openGate, closeGate } from '../core/gate';
import { voiceBus } from '../core/voice-bus';
import { orchestrator } from '../core/orchestrator';
import { ensureMicPermission } from '../core/permissions';

// Type for the Web Speech API
type SpeechRecognitionType = any;

interface AlwaysListenState {
  isListening: boolean;
  hasPermission: boolean;
  gateOpen: boolean;
  error: string | null;
  isInitialized: boolean;
}

export function useAlwaysListen(autoStart: boolean = false) {
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const isStartingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  
  const [state, setState] = useState<AlwaysListenState>({
    isListening: false,
    hasPermission: false,
    gateOpen: false,
    error: null,
    isInitialized: false
  });
  
  /**
   * Initialize recognition with user gesture (required for iOS Safari)
   */
  const initializeWithGesture = useCallback(async () => {
    if (hasInitializedRef.current || isStartingRef.current) {
      debugBus.info('AlwaysListen', 'already_initialized', {});
      return false;
    }
    
    isStartingRef.current = true;
    
    try {
      debugBus.info('AlwaysListen', 'init_with_gesture', {});
      
      // Ensure permission (requires user gesture)
      const permStatus = await ensureMicPermission();
      
      if (!permStatus.granted) {
        // CRITICAL FIX: Handle device not found differently from permission denied
        const errorMessage = permStatus.error || 'Permission denied';
        const isDeviceNotFound = errorMessage.includes('No microphone device found');
        
        setState(prev => ({ 
          ...prev, 
          hasPermission: false, 
          error: errorMessage
        }));
        
        if (isDeviceNotFound) {
          debugBus.error('AlwaysListen', 'device_not_found', {
            message: 'No microphone device available - text chat only mode'
          });
        } else {
          debugBus.error('AlwaysListen', 'permission_denied', {});
        }
        return false;
      }
      
      setState(prev => ({ ...prev, hasPermission: true }));
      
      // Open the gate
      const gateOpened = await openGate('user_gesture');
      
      if (!gateOpened) {
        setState(prev => ({ 
          ...prev, 
          gateOpen: false, 
          error: 'Gate failed to open' 
        }));
        return false;
      }
      
      setState(prev => ({ ...prev, gateOpen: true }));
      
      // Create and configure recognition
      if (!recognitionRef.current) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          throw new Error('Speech recognition not supported');
        }
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // Setup event handlers
        recognition.onstart = () => {
          debugBus.info('AlwaysListen', 'Recognition started', {});
          setState(prev => ({ ...prev, isListening: true, error: null }));
        };
        
        recognition.onend = () => {
          debugBus.info('AlwaysListen', 'Recognition ended', {});
          setState(prev => ({ ...prev, isListening: false }));
          
          // Auto-restart if gate is open
          if (voiceGate.isGateOpen()) {
            setTimeout(() => {
              startListening();
            }, 500);
          }
        };
        
        recognition.onerror = (event: any) => {
          debugBus.error('AlwaysListen', 'Recognition error', { 
            error: event.error 
          });
          
          // CRITICAL FIX: Handle different error types properly
          if (event.error === 'not-allowed') {
            closeGate('permission_error');
            setState(prev => ({ 
              ...prev, 
              hasPermission: false, 
              error: 'Permission denied' 
            }));
          } else if (event.error === 'no-speech' || event.error === 'audio-capture') {
            // Check if this might be a device not found issue
            if (sessionStorage.getItem('mic_device_not_found') === 'true') {
              closeGate('device_not_found');
              setState(prev => ({ 
                ...prev, 
                hasPermission: false, 
                error: 'No microphone device found' 
              }));
            }
          }
        };
        
        recognition.onresult = (event: any) => {
          const last = event.results.length - 1;
          const result = event.results[last];
          
          if (result.isFinal) {
            const transcript = result[0].transcript;
            debugBus.info('AlwaysListen', 'Final transcript', { transcript });
            
            // Route through orchestrator
            orchestrator.routeMessage({
              text: transcript,
              source: 'voice'
            }).then(decision => {
              if (decision.shouldProcess) {
                orchestrator.processMessage({
                  text: transcript,
                  source: 'voice'
                }, decision);
              }
            });
          }
        };
        
        recognitionRef.current = recognition;
      }
      
      // Start recognition
      recognitionRef.current.start();
      hasInitializedRef.current = true;
      setState(prev => ({ ...prev, isInitialized: true }));
      
      debugBus.info('AlwaysListen', 'init_complete', {});
      return true;
    } catch (error) {
      debugBus.error('AlwaysListen', 'init_failed', { 
        error: String(error) 
      });
      setState(prev => ({ 
        ...prev, 
        error: String(error) 
      }));
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, []);
  
  /**
   * Start listening (will initialize if needed)
   */
  const startListening = useCallback(async () => {
    if (!hasInitializedRef.current) {
      // Can't start without user gesture
      debugBus.warn('AlwaysListen', 'start_needs_gesture', {});
      return false;
    }
    
    if (!voiceGate.isGateOpen()) {
      debugBus.warn('AlwaysListen', 'start_blocked_gate', {});
      return false;
    }
    
    if (recognitionRef.current && !state.isListening) {
      try {
        recognitionRef.current.start();
        return true;
      } catch (error) {
        debugBus.error('AlwaysListen', 'start_error', { 
          error: String(error) 
        });
        return false;
      }
    }
    
    return false;
  }, [state.isListening]);
  
  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        debugBus.error('AlwaysListen', 'stop_error', { 
          error: String(error) 
        });
      }
    }
  }, [state.isListening]);
  
  // Handle user gestures to initialize
  useEffect(() => {
    const handleGesture = async (event: Event) => {
      // Only initialize on first gesture
      if (!hasInitializedRef.current && !isStartingRef.current) {
        const type = event.type === 'touchstart' ? 'tap' : 
                     event.type === 'click' ? 'click' : 'keypress';
        
        debugBus.info('AlwaysListen', 'user_gesture_detected', { type });
        
        // Handle through orchestrator first
        await orchestrator.handleUserGesture(type as any);
        
        // Then initialize recognition
        await initializeWithGesture();
      }
    };
    
    // Listen for user gestures
    document.addEventListener('click', handleGesture, { once: false });
    document.addEventListener('touchstart', handleGesture, { once: false });
    document.addEventListener('keypress', handleGesture, { once: false });
    
    return () => {
      document.removeEventListener('click', handleGesture);
      document.removeEventListener('touchstart', handleGesture);
      document.removeEventListener('keypress', handleGesture);
    };
  }, [initializeWithGesture]);
  
  // Subscribe to gate state changes
  useEffect(() => {
    const unsubscribe = voiceGate.onStateChange((isOpen) => {
      setState(prev => ({ ...prev, gateOpen: isOpen }));
      
      if (isOpen && hasInitializedRef.current && !state.isListening) {
        startListening();
      } else if (!isOpen && state.isListening) {
        stopListening();
      }
    });
    
    return unsubscribe;
  }, [state.isListening, startListening, stopListening]);
  
  // Listen for voice bus events
  useEffect(() => {
    const handleStart = voiceBus.on('start_listening', () => {
      if (hasInitializedRef.current) {
        startListening();
      }
    });
    
    const handleStop = voiceBus.on('stop_listening', () => {
      stopListening();
    });
    
    return () => {
      handleStart();
      handleStop();
    };
  }, [startListening, stopListening]);
  
  // Auto-start if requested (after first gesture)
  useEffect(() => {
    if (autoStart && hasInitializedRef.current && !state.isListening) {
      startListening();
    }
  }, [autoStart, state.isListening, startListening]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);
  
  return {
    ...state,
    initializeWithGesture,
    startListening,
    stopListening
  };
}