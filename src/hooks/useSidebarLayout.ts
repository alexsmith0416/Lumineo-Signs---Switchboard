import { useState, useCallback } from 'react';
import { VIEW_GROUPS } from '../data/viewConfigs';

export interface SidebarGroup {
  id: string;
  label: string;
  views: string[];
}

function storageKey(scheduleId: string) {
  return scheduleId === 'default' ? 'lni_sidebarLayout' : `lni_sidebarLayout_${scheduleId}`;
}

function defaultLayout(scheduleId: string): SidebarGroup[] {
  if (scheduleId === 'default') {
    return VIEW_GROUPS.map((g, i) => ({
      id: `g${i}`,
      label: g.label ?? `Group ${i + 1}`,
      views: [...g.views],
    }));
  }
  return [{ id: 'g0', label: 'Views', views: [] }];
}

function load(scheduleId: string): SidebarGroup[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(scheduleId)) ?? 'null');
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch { /* ignore */ }
  return defaultLayout(scheduleId);
}

function save(scheduleId: string, layout: SidebarGroup[]) {
  localStorage.setItem(storageKey(scheduleId), JSON.stringify(layout));
}

export function useSidebarLayout(scheduleId: string) {
  const [groups, setGroups] = useState<SidebarGroup[]>(() => load(scheduleId));

  const moveView = useCallback((viewKey: string, toGroupId: string, toIndex: number) => {
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, views: [...g.views] }));
      for (const g of next) {
        const idx = g.views.indexOf(viewKey);
        if (idx !== -1) { g.views.splice(idx, 1); break; }
      }
      const target = next.find(g => g.id === toGroupId);
      if (target) target.views.splice(toIndex, 0, viewKey);
      save(scheduleId, next);
      return next;
    });
  }, [scheduleId]);

  const moveGroup = useCallback((groupId: string, toIndex: number) => {
    setGroups(prev => {
      const next = [...prev];
      const from = next.findIndex(g => g.id === groupId);
      if (from === -1) return prev;
      const [item] = next.splice(from, 1);
      next.splice(toIndex, 0, item);
      save(scheduleId, next);
      return next;
    });
  }, [scheduleId]);

  const renameGroup = useCallback((groupId: string, label: string) => {
    setGroups(prev => {
      const next = prev.map(g => g.id === groupId ? { ...g, label: label.trim() || g.label } : g);
      save(scheduleId, next);
      return next;
    });
  }, [scheduleId]);

  const addGroup = useCallback((label: string) => {
    setGroups(prev => {
      const next = [...prev, { id: `g${Date.now()}`, label: label.trim() || 'New Group', views: [] }];
      save(scheduleId, next);
      return next;
    });
  }, [scheduleId]);

  const deleteGroup = useCallback((groupId: string) => {
    setGroups(prev => {
      if (prev.length <= 1) return prev;
      const dying = prev.find(g => g.id === groupId);
      if (!dying) return prev;
      const surviving = prev.filter(g => g.id !== groupId);
      if (dying.views.length > 0) {
        surviving[0] = { ...surviving[0], views: [...surviving[0].views, ...dying.views] };
      }
      save(scheduleId, surviving);
      return surviving;
    });
  }, [scheduleId]);

  const addView = useCallback((viewKey: string, groupId?: string) => {
    setGroups(prev => {
      const targetId = groupId ?? prev[0]?.id;
      const next = prev.map(g =>
        g.id === targetId ? { ...g, views: [...g.views, viewKey] } : g
      );
      save(scheduleId, next);
      return next;
    });
  }, [scheduleId]);

  const removeView = useCallback((viewKey: string) => {
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, views: g.views.filter(v => v !== viewKey) }));
      save(scheduleId, next);
      return next;
    });
  }, [scheduleId]);

  return { groups, moveView, moveGroup, renameGroup, addGroup, deleteGroup, addView, removeView };
}
