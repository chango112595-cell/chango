import { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';

export type UIMode = "header" | "sphere";

const KEY = "chango.uiMode";
const DEFAULT_MODE: UIMode = "sphere";

interface UIModeContextType {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
}

// Create the context
const UIModeContext = createContext<UIModeContextType | undefined>(undefined);

// Provider component
export function UIModeProvider({ children }: { children: ReactNode }) {
  // Initialize state with value from localStorage or default
  const [mode, setModeState] = useState<UIMode>(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "header" || stored === "sphere") {
        return stored;
      }
    } catch (error) {
      console.error("Failed to read UI mode from localStorage:", error);
    }
    return DEFAULT_MODE;
  });

  // Persist mode to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(KEY, mode);
    } catch (error) {
      console.error("Failed to save UI mode to localStorage:", error);
    }
  }, [mode]);

  // Listen for storage events to sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        if (e.newValue === "header" || e.newValue === "sphere") {
          setModeState(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Wrap the setter to ensure type safety
  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
  }, []);

  return (
    <UIModeContext.Provider value={{ mode, setMode }}>
      {children}
    </UIModeContext.Provider>
  );
}

// Hook to use the UI mode context
export function useUIMode() {
  const context = useContext(UIModeContext);
  
  if (context === undefined) {
    throw new Error('useUIMode must be used within a UIModeProvider');
  }
  
  return context;
}