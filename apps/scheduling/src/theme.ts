import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "lumineo-theme";

/**
 * Resolve the startup theme. Per the build brief we default to LIGHT on first
 * load and deliberately do NOT honor prefers-color-scheme — only an explicit,
 * persisted user choice switches to dark.
 */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode / storage disabled — fall back to in-memory only */
  }
  applyTheme(theme);
}

/** React hook: current theme + a toggle that persists and applies the change. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      persistTheme(next);
      return next;
    });
  }, []);
  return { theme, toggle };
}
