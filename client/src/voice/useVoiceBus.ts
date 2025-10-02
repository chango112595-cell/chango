import { useState, useEffect } from "react";
import { voiceBus } from "./voiceBus";

export function useVoiceBus() {
  const [state, setState] = useState({
    systemOnline: true,
    isSpeaking: false,
    isMuted: false,
  });

  useEffect(() => {
    // Listen for state changes from voiceBus
    const unsubscribers: Array<() => void> = [];

    // Listen for speaking state changes
    unsubscribers.push(
      voiceBus.on('speakingChange', (event) => {
        setState(prev => ({ ...prev, isSpeaking: event.speaking || false }));
      })
    );

    // Listen for mute state changes
    unsubscribers.push(
      voiceBus.on('muteChange', (event) => {
        setState(prev => ({ ...prev, isMuted: event.muted || false }));
      })
    );

    // Listen for any state changes
    unsubscribers.push(
      voiceBus.on('stateChange', (event) => {
        if (event.state) {
          setState(prev => ({
            ...prev,
            isSpeaking: event.state?.speaking ?? false,
            isMuted: event.state?.mute ?? false,
          }));
        }
      })
    );

    // Check if speech synthesis is available and update online status
    const checkSystemStatus = () => {
      const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
      setState(prev => ({ ...prev, systemOnline: speechAvailable }));
    };

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 5000);

    // Get initial state from voiceBus
    const initialState = voiceBus.getState();
    setState(prev => ({
      ...prev,
      isSpeaking: initialState.speaking,
      isMuted: initialState.mute,
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(interval);
    };
  }, []);

  return {
    systemOnline: state.systemOnline,
    isSpeaking: state.isSpeaking,
    isMuted: state.isMuted,
    setMuted: (muted: boolean) => voiceBus.setMute(muted),
  };
}