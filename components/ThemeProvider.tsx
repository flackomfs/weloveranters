'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { DEFAULT_THEME, getThemePalette, type ThemePalette } from '@/lib/themes';

type ThemeContextValue = {
  theme: ThemePalette;
  chooseTheme: (theme: ThemePalette) => Promise<boolean>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'weloveranters-theme';

function applyTheme(theme: ThemePalette) {
  const root = document.documentElement;
  root.dataset.themeActive = 'true';
  root.style.setProperty('--theme-primary', theme.colors[0]);
  root.style.setProperty('--theme-secondary', theme.colors[1]);
  root.style.setProperty('--theme-background', theme.colors[2]);
  root.style.setProperty('--brand', theme.colors[0]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const selectTheme = useCallback((nextTheme: ThemePalette) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme.id);
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    if (storedTheme) selectTheme(getThemePalette(storedTheme));

    const auth = getFirebaseAuth();
    if (!auth) return;

    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/settings', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.theme?.id) selectTheme(getThemePalette(data.theme.id));
      } catch {
        // Keep the locally cached palette when account settings cannot be reached.
      }
    });
  }, [selectTheme]);

  const chooseTheme = useCallback(async (nextTheme: ThemePalette) => {
    selectTheme(nextTheme);
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) return true;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ themeId: nextTheme.id })
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [selectTheme]);

  return <ThemeContext.Provider value={{ theme, chooseTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}