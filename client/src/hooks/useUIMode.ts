import { useState, useEffect, useCallback } from 'react';

export type UIMode = "header" | "sphere";

const KEY = "chango.uiMode";
const DEFAULT_MODE: UIMode = "sphere";

export const useUIMode = () => {
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

  // Wrap the setter to ensure type safety
  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
  }, []);

  return { mode, setMode };
};