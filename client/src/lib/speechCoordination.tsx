import { createContext, useContext, useState, useRef } from "react";

interface SpeechCoordinationState {
  lastChatActivity: number;
  isChatActive: boolean;
  setLastChatActivity: (timestamp: number) => void;
  setChatActive: (active: boolean) => void;
  canCuriositySpeak: () => boolean;
}

const SpeechCoordinationContext = createContext<SpeechCoordinationState | undefined>(undefined);

export function useSpeechCoordination() {
  const context = useContext(SpeechCoordinationContext);
  if (!context) {
    // Return a default implementation if no provider
    return {
      lastChatActivity: 0,
      isChatActive: false,
      setLastChatActivity: () => {},
      setChatActive: () => {},
      canCuriositySpeak: () => true,
    };
  }
  return context;
}

export function SpeechCoordinationProvider({ children }: { children: React.ReactNode }) {
  const [lastChatActivity, setLastChatActivityState] = useState(0);
  const [isChatActive, setIsChatActive] = useState(false);
  const lastChatActivityRef = useRef(0);
  const isChatActiveRef = useRef(false);
  
  const setLastChatActivity = (timestamp: number) => {
    lastChatActivityRef.current = timestamp;
    setLastChatActivityState(timestamp);
  };
  
  const setChatActive = (active: boolean) => {
    isChatActiveRef.current = active;
    setIsChatActive(active);
  };
  
  const canCuriositySpeak = () => {
    // Don't speak if chat is active
    if (isChatActiveRef.current) {
      return false;
    }
    
    // Don't speak within 10 seconds of chat activity
    const timeSinceChat = Date.now() - lastChatActivityRef.current;
    if (timeSinceChat < 10000) {
      return false;
    }
    
    return true;
  };
  
  const value = {
    lastChatActivity,
    isChatActive,
    setLastChatActivity,
    setChatActive,
    canCuriositySpeak,
  };
  
  return (
    <SpeechCoordinationContext.Provider value={value}>
      {children}
    </SpeechCoordinationContext.Provider>
  );
}