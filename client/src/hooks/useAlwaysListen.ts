/**
 * Always Listen Hook
 * WRAPPER around the singleton alwaysListen module
 * NO LONGER creates its own SpeechRecognition - uses the singleton instead
 */

import { useEffect, useState, useCallback } from 'react';
import { alwaysListen } from '../voice/always_listen';
import { debugBus } from '../dev/debugBus';
import { voiceGate, openGate } from '../core/gate';
import { ensureMicPermission } from '../core/permissions';

interface AlwaysListenState {
  isListening: boolean;
  hasPermission: boolean;
  gateOpen: boolean;
  error: string | null;
  isInitialized: boolean;
}

export function useAlwaysListen(autoStart: boolean = false) {
  const [state, setState] = useState<AlwaysListenState>({
    isListening: false,
    hasPermission: false,
    gateOpen: false,
    error: null,
    isInitialized: false
  });
  
  /**
   * Update state from singleton status
   */
  const updateStateFromSingleton = useCallback(() => {
    const status = alwaysListen.getStatus();
    setState(prev => ({
      ...prev,
      isListening: status.isListening,
      hasPermission: status.hasPermission,
      isInitialized: status.isEnabled,
      gateOpen: voiceGate.isGateOpen(),
      error: status.error || null
    }));
  }, []);
  
  /**
   * Initialize with user gesture (required for iOS Safari)
   * Now delegates to the singleton instead of creating its own recognition
   */
  const initializeWithGesture = useCallback(async () => {
    debugBus.info('useAlwaysListen', 'init_with_gesture_wrapper', {});
    
    try {
      // Ensure permission (requires user gesture)
      const permStatus = await ensureMicPermission();
      
      if (!permStatus.granted) {
        const errorMessage = permStatus.error || 'Permission denied';
        const isDeviceNotFound = errorMessage.includes('No microphone device found');
        
        setState(prev => ({ 
          ...prev, 
          hasPermission: false, 
          error: errorMessage
        }));
        
        if (isDeviceNotFound) {
          debugBus.error('useAlwaysListen', 'device_not_found', {
            message: 'No microphone device available - text chat only mode'
          });
        } else {
          debugBus.error('useAlwaysListen', 'permission_denied', {});
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
      
      // Initialize and start the singleton alwaysListen
      await alwaysListen.initialize();
      await alwaysListen.start();
      
      // Update state from singleton
      updateStateFromSingleton();
      
      debugBus.info('useAlwaysListen', 'init_complete_via_singleton', {});
      return true;
    } catch (error) {
      debugBus.error('useAlwaysListen', 'init_failed', { 
        error: String(error) 
      });
      setState(prev => ({ 
        ...prev, 
        error: String(error) 
      }));
      return false;
    }
  }, [updateStateFromSingleton]);
  
  /**
   * Start listening via singleton
   */
  const startListening = useCallback(async () => {
    if (!voiceGate.isGateOpen()) {
      debugBus.warn('useAlwaysListen', 'start_blocked_gate', {});
      return false;
    }
    
    try {
      await alwaysListen.start();
      updateStateFromSingleton();
      return true;
    } catch (error) {
      debugBus.error('useAlwaysListen', 'start_error', { 
        error: String(error) 
      });
      return false;
    }
  }, [updateStateFromSingleton]);
  
  /**
   * Stop listening via singleton
   */
  const stopListening = useCallback(() => {
    try {
      alwaysListen.stop();
      updateStateFromSingleton();
    } catch (error) {
      debugBus.error('useAlwaysListen', 'stop_error', { 
        error: String(error) 
      });
    }
  }, [updateStateFromSingleton]);
  
  // Poll singleton status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateStateFromSingleton();
    }, 500);
    
    return () => clearInterval(interval);
  }, [updateStateFromSingleton]);
  
  // Subscribe to gate state changes
  useEffect(() => {
    const unsubscribe = voiceGate.onStateChange((isOpen) => {
      setState(prev => ({ ...prev, gateOpen: isOpen }));
      
      if (isOpen && state.isInitialized && !state.isListening) {
        startListening();
      } else if (!isOpen && state.isListening) {
        stopListening();
      }
    });
    
    return unsubscribe;
  }, [state.isListening, state.isInitialized, startListening, stopListening]);
  
  // Auto-start if requested
  useEffect(() => {
    if (autoStart && state.isInitialized && !state.isListening) {
      startListening();
    }
  }, [autoStart, state.isListening, state.isInitialized, startListening]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // No cleanup needed - singleton manages its own lifecycle
      debugBus.info('useAlwaysListen', 'unmounting', {});
    };
  }, []);
  
  return {
    ...state,
    initializeWithGesture,
    startListening,
    stopListening
  };
}