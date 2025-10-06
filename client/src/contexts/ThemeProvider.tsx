/**
 * Theme Provider
 * Manages application theme state, persistence, and system preference detection
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'classic' | 'hud' | 'auto';
export type ResolvedTheme = 'classic' | 'hud';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'lolo-theme';
const THEME_CLASS_PREFIX = 'theme-';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'auto',
  storageKey = STORAGE_KEY 
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Try to get theme from localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['classic', 'hud', 'auto'].includes(stored)) {
        return stored as Theme;
      }
    } catch (e) {
      console.warn('[ThemeProvider] Failed to read theme from localStorage:', e);
    }
    return defaultTheme;
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      // For this app, we'll use 'prefers-color-scheme: dark' to determine HUD theme
      // Since both themes are dark, we'll use a custom logic
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      // Default to classic for now, could be enhanced with more specific system detection
      return 'classic';
    }
    return 'classic';
  });

  // Resolved theme is what actually gets applied
  const resolvedTheme: ResolvedTheme = theme === 'auto' ? systemTheme : theme as ResolvedTheme;

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Since both themes are dark, we could use additional heuristics
      // For now, we'll keep classic as default
      setSystemTheme('classic');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    
    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  // Apply theme class to document.body
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    // Remove all theme classes
    const themeClasses = Array.from(body.classList).filter(cls => 
      cls.startsWith(THEME_CLASS_PREFIX)
    );
    themeClasses.forEach(cls => body.classList.remove(cls));
    
    // Also remove from root for better compatibility
    themeClasses.forEach(cls => root.classList.remove(cls));
    
    // Apply the resolved theme class
    if (resolvedTheme === 'hud') {
      body.classList.add('theme-hud');
      root.classList.add('theme-hud');
    } else {
      // Classic is the default, no additional class needed
      // But we'll add it for consistency
      body.classList.add('theme-classic');
      root.classList.add('theme-classic');
    }

    console.log('[ThemeProvider] Applied theme:', resolvedTheme);
  }, [resolvedTheme]);

  // Persist theme to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, theme);
      console.log('[ThemeProvider] Saved theme to localStorage:', theme);
    } catch (e) {
      console.warn('[ThemeProvider] Failed to save theme to localStorage:', e);
    }
  }, [theme, storageKey]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    console.log('[ThemeProvider] Theme changed to:', newTheme);
  }, []);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to use theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Optional: Export a hook to get just the resolved theme
export function useResolvedTheme(): ResolvedTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme;
}

// Optional: Export a hook to check if a specific theme is active
export function useIsTheme(checkTheme: ResolvedTheme): boolean {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === checkTheme;
}