import { useState, useCallback } from 'react';

function key(scheduleId: string) {
  return scheduleId === 'default' ? 'lni_viewNames' : `lni_viewNames_${scheduleId}`;
}

function load(scheduleId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(key(scheduleId)) ?? 'null') ?? {}; }
  catch { return {}; }
}

export function useViewNames(scheduleId: string) {
  const [names, setNames] = useState<Record<string, string>>(() => load(scheduleId));

  const getDisplayName = useCallback((viewKey: string): string =>
    names[viewKey] ?? viewKey, [names]);

  const setDisplayName = useCallback((viewKey: string, name: string) => {
    const trimmed = name.trim();
    setNames(prev => {
      const next = trimmed && trimmed !== viewKey
        ? { ...prev, [viewKey]: trimmed }
        : (() => { const { [viewKey]: _, ...rest } = prev; return rest; })();
      localStorage.setItem(key(scheduleId), JSON.stringify(next));
      return next;
    });
  }, [scheduleId]);

  return { getDisplayName, setDisplayName };
}
