import { useState, useCallback } from 'react';

export interface Schedule {
  id: string;
  name: string;
  createdAt: string;
  color: string;
}

const SCHEDULES_KEY = 'lni_schedules';

const CARD_COLORS = [
  '#141464', '#1a6b3a', '#7c3d8c', '#b5471a', '#1a5f7a', '#6b3d1a',
  '#8b1a1a', '#1a4a7c', '#4a7c1a', '#7c4a1a',
];

function nextColor(schedules: Schedule[]): string {
  return CARD_COLORS[schedules.length % CARD_COLORS.length];
}

const DEFAULT_SCHEDULE: Schedule = {
  id: 'default',
  name: 'LNI Production Schedule',
  createdAt: new Date().toISOString(),
  color: '#141464',
};

function load(): Schedule[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SCHEDULES_KEY) ?? 'null');
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch { /* ignore */ }
  const initial = [DEFAULT_SCHEDULE];
  localStorage.setItem(SCHEDULES_KEY, JSON.stringify(initial));
  return initial;
}

function save(schedules: Schedule[]) {
  localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
}

// Copy all localStorage keys for one schedule to another
export function duplicateScheduleData(fromId: string, toId: string) {
  const suffixedKeys = ['lni_customFieldDefs', 'lni_customFieldVals', 'lni_sidebarLayout', 'lni_viewNames'];
  for (const base of suffixedKeys) {
    const fromKey = fromId === 'default' ? base : `${base}_${fromId}`;
    const toKey = toId === 'default' ? base : `${base}_${toId}`;
    const data = localStorage.getItem(fromKey);
    if (data) localStorage.setItem(toKey, data);
  }
}

export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>(load);

  const createSchedule = useCallback((name: string): Schedule => {
    const newSchedule: Schedule = {
      id: `s${Date.now()}`,
      name: name.trim() || 'New Schedule',
      createdAt: new Date().toISOString(),
      color: nextColor(schedules),
    };
    const next = [...schedules, newSchedule];
    setSchedules(next);
    save(next);
    return newSchedule;
  }, [schedules]);

  const duplicateSchedule = useCallback((id: string): Schedule => {
    const source = schedules.find(s => s.id === id)!;
    const copy: Schedule = {
      id: `s${Date.now()}`,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      color: nextColor(schedules),
    };
    duplicateScheduleData(id, copy.id);
    const next = [...schedules, copy];
    setSchedules(next);
    save(next);
    return copy;
  }, [schedules]);

  const renameSchedule = useCallback((id: string, name: string) => {
    setSchedules(prev => {
      const next = prev.map(s => s.id === id ? { ...s, name: name.trim() || s.name } : s);
      save(next);
      return next;
    });
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(s => s.id !== id);
      save(next);
      // Clean up localStorage data for deleted schedule
      const suffixedKeys = ['lni_customFieldDefs', 'lni_customFieldVals', 'lni_sidebarLayout', 'lni_viewNames'];
      for (const base of suffixedKeys) {
        const key = id === 'default' ? base : `${base}_${id}`;
        localStorage.removeItem(key);
      }
      return next;
    });
  }, []);

  return { schedules, createSchedule, duplicateSchedule, renameSchedule, deleteSchedule };
}
