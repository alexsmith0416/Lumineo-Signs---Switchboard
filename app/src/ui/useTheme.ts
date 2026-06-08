// Theme hook — light / dark on the document root via data-theme.
// First-load priority: localStorage > prefers-color-scheme > "light".
// Persists the user's choice for next visit.

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "signbuilderpro.theme";

function detectInitial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* private mode etc. */ }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => detectInitial());

  // Reflect the theme on <html data-theme=""> so CSS variables flip.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return { theme, setTheme, toggleTheme };
}
