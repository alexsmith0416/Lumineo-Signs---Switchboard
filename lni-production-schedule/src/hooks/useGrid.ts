import { useState, useCallback, useEffect, useRef } from 'react';
import type { LniRecord } from '../types/schema';

export interface SortCriterion {
  field: string;
  asc: boolean;
}

export interface FilterCondition {
  id: string;
  field: string;
  op: 'contains' | 'not_contains' | 'is' | 'is_not' | 'is_empty' | 'is_not_empty';
  value: string;
}

export interface GridState {
  searchQuery: string;
  sorts: SortCriterion[];
  filters: FilterCondition[];
  groupField: string | null;
  manualOrder: string[] | null;
}

interface PersistedPrefs {
  sorts: SortCriterion[];
  filters: FilterCondition[];
  groupField: string | null;
}

function gsKey(scheduleId: string, viewName: string) {
  return `lni_gs_${scheduleId}_${encodeURIComponent(viewName)}`;
}

function loadGs(scheduleId: string, viewName: string): PersistedPrefs {
  try {
    const raw = localStorage.getItem(gsKey(scheduleId, viewName));
    if (!raw) return { sorts: [], filters: [], groupField: null };
    const parsed = JSON.parse(raw);
    return {
      sorts: parsed.sorts ?? [],
      filters: parsed.filters ?? [],
      groupField: parsed.groupField ?? null,
    };
  } catch {
    return { sorts: [], filters: [], groupField: null };
  }
}

export function useGrid(records: LniRecord[], scheduleId: string, activeView: string, getCustomValue?: (id: string, key: string) => unknown) {
  const [state, setState] = useState<GridState>(() => {
    const prefs = loadGs(scheduleId, activeView);
    return {
      searchQuery: '',
      sorts: prefs.sorts,
      filters: prefs.filters,
      groupField: prefs.groupField,
      manualOrder: null,
    };
  });

  const activeViewRef = useRef(activeView);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Reset on view change
  useEffect(() => {
    if (activeViewRef.current === activeView) return;
    activeViewRef.current = activeView;
    setState(s => ({ ...s, ...loadGs(scheduleId, activeView), searchQuery: '', manualOrder: null }));
  }, [activeView, scheduleId]);

  // Helper to save persisted portion
  const save = useCallback((partial: PersistedPrefs) => {
    localStorage.setItem(gsKey(scheduleId, activeViewRef.current), JSON.stringify(partial));
  }, [scheduleId]);

  const setSearch = useCallback((q: string) =>
    setState(s => ({ ...s, searchQuery: q })), []);

  const setSorts = useCallback((sorts: SortCriterion[]) => {
    setState(s => {
      const next = { ...s, sorts, manualOrder: null };
      save({ sorts, filters: s.filters, groupField: s.groupField });
      return next;
    });
  }, [save]);

  const setFilters = useCallback((filters: FilterCondition[]) => {
    setState(s => {
      const next = { ...s, filters };
      save({ sorts: s.sorts, filters, groupField: s.groupField });
      return next;
    });
  }, [save]);

  const setGroupField = useCallback((groupField: string | null) => {
    setState(s => {
      const next = { ...s, groupField };
      save({ sorts: s.sorts, filters: s.filters, groupField });
      return next;
    });
  }, [save]);

  const setManualOrder = useCallback((manualOrder: string[] | null) =>
    setState(s => ({ ...s, manualOrder, sorts: manualOrder ? [] : s.sorts })), []);

  const toggleSort = useCallback((field: string) => {
    setState(s => {
      const existing = s.sorts.find(sc => sc.field === field);
      let sorts: SortCriterion[];
      if (!existing) {
        sorts = [{ field, asc: true }];
      } else if (existing.asc) {
        sorts = [{ field, asc: false }];
      } else {
        sorts = [];
      }
      const next = { ...s, sorts, manualOrder: null };
      save({ sorts, filters: s.filters, groupField: s.groupField });
      return next;
    });
  }, [save]);

  const filtered = applyAll(records, state, getCustomValue);

  return { state, filtered, setSearch, setSorts, setFilters, setGroupField, setManualOrder, toggleSort };
}

function applyAll(records: LniRecord[], state: GridState, getCustomValue?: (id: string, key: string) => unknown): LniRecord[] {
  let result = records;

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    result = result.filter(r =>
      (r.job      ?? '').toLowerCase().includes(q) ||
      (r.status   ?? '').toLowerCase().includes(q) ||
      (r.location ?? '').toLowerCase().includes(q) ||
      (r.sales    ?? '').toLowerCase().includes(q) ||
      (r.notes    ?? '').toLowerCase().includes(q)
    );
  }

  for (const cond of state.filters) {
    result = result.filter(r => matchFilter(r, cond, getCustomValue));
  }

  if (state.manualOrder) {
    const order = state.manualOrder;
    result = [...result].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  } else if (state.sorts.length > 0) {
    result = [...result].sort((a, b) => {
      for (const { field, asc } of state.sorts) {
        const f = field as keyof LniRecord;
        const av = a[f] ?? '';
        const bv = b[f] ?? '';
        if (av < bv) return asc ? -1 : 1;
        if (av > bv) return asc ? 1 : -1;
      }
      return 0;
    });
  }

  return result;
}

function matchFilter(r: LniRecord, cond: FilterCondition, getCustomValue?: (id: string, key: string) => unknown): boolean {
  const raw = cond.field.startsWith('cf_') && getCustomValue
    ? getCustomValue(r.id, cond.field)
    : r[cond.field as keyof LniRecord];
  const val = String(raw ?? '').toLowerCase();
  const target = cond.value.toLowerCase();
  switch (cond.op) {
    case 'contains':     return val.includes(target);
    case 'not_contains': return !val.includes(target);
    case 'is':           return val === target;
    case 'is_not':       return val !== target;
    case 'is_empty':     return val === '';
    case 'is_not_empty': return val !== '';
    default:             return true;
  }
}
