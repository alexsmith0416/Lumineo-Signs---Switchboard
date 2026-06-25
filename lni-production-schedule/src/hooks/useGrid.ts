import { useState, useCallback, useEffect, useRef } from 'react';

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

// Query-state manager only. Sorting / filtering / searching / grouping are
// expressed as OData query params by the data layer (see odata.ts) — this hook
// no longer runs any client-side pass over the dataset.
export function useGrid(scheduleId: string, activeView: string) {
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

  // Reset on view change
  useEffect(() => {
    if (activeViewRef.current === activeView) return;
    activeViewRef.current = activeView;
    setState(s => ({ ...s, ...loadGs(scheduleId, activeView), searchQuery: '', manualOrder: null }));
  }, [activeView, scheduleId]);

  const save = useCallback((partial: PersistedPrefs) => {
    localStorage.setItem(gsKey(scheduleId, activeViewRef.current), JSON.stringify(partial));
  }, [scheduleId]);

  const setSearch = useCallback((q: string) =>
    setState(s => ({ ...s, searchQuery: q })), []);

  const setSorts = useCallback((sorts: SortCriterion[]) => {
    setState(s => {
      save({ sorts, filters: s.filters, groupField: s.groupField });
      return { ...s, sorts, manualOrder: null };
    });
  }, [save]);

  const setFilters = useCallback((filters: FilterCondition[]) => {
    setState(s => {
      save({ sorts: s.sorts, filters, groupField: s.groupField });
      return { ...s, filters };
    });
  }, [save]);

  const setGroupField = useCallback((groupField: string | null) => {
    setState(s => {
      save({ sorts: s.sorts, filters: s.filters, groupField });
      return { ...s, groupField };
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
      save({ sorts, filters: s.filters, groupField: s.groupField });
      return { ...s, sorts, manualOrder: null };
    });
  }, [save]);

  return { state, setSearch, setSorts, setFilters, setGroupField, setManualOrder, toggleSort };
}
