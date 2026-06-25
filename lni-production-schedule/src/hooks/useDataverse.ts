import { useState, useEffect, useCallback, useRef } from 'react';
import type { LniRecord } from '../types/schema';
import {
  fetchRecordsPage,
  updateRecordFields,
  createRecord,
  type PageResult,
} from '../data/dataverse';
import { PAGE_SIZE, type QueryParams } from '../data/odata';
import { computeCalcFields } from './calcFields';
import type { SortCriterion, FilterCondition } from './useGrid';

export type DataverseState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: LniRecord[] };

// The slice of grid state that drives a server-side query.
export interface FetchQuery {
  viewCols: string[];
  sorts: SortCriterion[];
  filters: FilterCondition[];
  groupField: string | null;
  searchQuery: string;
}

const WRITE_DEBOUNCE_MS = 500;

const EMPTY_QUERY: FetchQuery = {
  viewCols: [], sorts: [], filters: [], groupField: null, searchQuery: '',
};

function toParams(q: FetchQuery, skipToken: string | null): QueryParams {
  return {
    viewCols: q.viewCols,
    sorts: q.sorts,
    filters: q.filters,
    groupField: q.groupField,
    searchQuery: q.searchQuery,
    top: PAGE_SIZE,
    skipToken,
  };
}

export function useDataverse(query: FetchQuery = EMPTY_QUERY) {
  const [state, setState] = useState<DataverseState>({ status: 'loading' });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  // Set of "<id>:<field>" keys whose last write failed.
  const [cellErrors, setCellErrors] = useState<Set<string>>(new Set());

  // Mutable mirrors so write callbacks always see the latest values.
  const recordsRef = useRef<LniRecord[]>([]);
  const skipTokenRef = useRef<string | null>(null);
  const queryRef = useRef<FetchQuery>(query);

  // Stable identity for the query so the fetch effect only fires on real changes.
  const queryKey = JSON.stringify(query);

  // Pending batched writes: id -> { field: value }, plus the previous values to
  // revert to on failure, plus one debounce timer per record.
  const pendingRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const prevValuesRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const applyState = useCallback((records: LniRecord[]) => {
    recordsRef.current = records;
    setState({ status: 'ready', records });
  }, []);

  // ── Initial / query-change load (page 1) ──────────────────────────────────
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setHasMore(false);
    skipTokenRef.current = null;
    try {
      const page: PageResult = await fetchRecordsPage(toParams(queryRef.current, null));
      const records = page.records.map(computeCalcFields);
      skipTokenRef.current = page.nextSkipToken;
      setHasMore(Boolean(page.nextSkipToken));
      setLastFetched(new Date());
      applyState(records);
    } catch (err) {
      const msg = String(err);
      // NO_CONTEXT = running outside Power Apps host. Show empty-ready so the UI
      // stays usable instead of erroring.
      if (msg.includes('NO_CONTEXT')) {
        applyState([]);
      } else {
        setState({ status: 'error', message: msg });
      }
    }
  }, [applyState]);

  useEffect(() => {
    queryRef.current = query;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // ── Cursor pagination ($skiptoken) ────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !skipTokenRef.current) return;
    setLoadingMore(true);
    try {
      const page = await fetchRecordsPage(toParams(queryRef.current, skipTokenRef.current));
      const more = page.records.map(computeCalcFields);
      skipTokenRef.current = page.nextSkipToken;
      setHasMore(Boolean(page.nextSkipToken));
      setLastFetched(new Date());
      applyState([...recordsRef.current, ...more]);
    } catch {
      // Leave the loaded page intact on a pagination failure.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, applyState]);

  // ── Batched optimistic writes ─────────────────────────────────────────────
  const flush = useCallback(async (id: string) => {
    const fields = pendingRef.current.get(id);
    pendingRef.current.delete(id);
    timersRef.current.delete(id);
    const prev = prevValuesRef.current.get(id);
    prevValuesRef.current.delete(id);
    if (!fields || Object.keys(fields).length === 0) return;

    try {
      await updateRecordFields(id, fields);
    } catch (err) {
      if (String(err).includes('NO_CONTEXT')) return; // dev/no-backend: keep optimistic
      // Revert the affected fields and flag the cells.
      if (prev) {
        const reverted = recordsRef.current.map(r =>
          r.id !== id ? r : computeCalcFields({ ...r, ...prev } as LniRecord)
        );
        applyState(reverted);
      }
      setCellErrors(prevSet => {
        const next = new Set(prevSet);
        for (const field of Object.keys(fields)) next.add(`${id}:${field}`);
        return next;
      });
    }
  }, [applyState]);

  const patch = useCallback((id: string, field: string, value: unknown) => {
    // 1. Capture the pre-edit value once per batch (before mutating) so a failed
    //    write can revert exactly the fields it changed.
    const current = recordsRef.current.find(r => r.id === id);
    const prevForId = prevValuesRef.current.get(id) ?? {};
    if (current && !(field in prevForId)) {
      prevForId[field] = current[field as keyof LniRecord];
      prevValuesRef.current.set(id, prevForId);
    }

    // 2. Optimistic local update — UI reflects the edit immediately.
    const updated = recordsRef.current.map(r =>
      r.id !== id ? r : computeCalcFields({ ...r, [field]: value } as LniRecord)
    );
    applyState(updated);

    // 3. Clear any stale error on this cell.
    setCellErrors(prevSet => {
      const key = `${id}:${field}`;
      if (!prevSet.has(key)) return prevSet;
      const next = new Set(prevSet);
      next.delete(key);
      return next;
    });

    // 4. Queue the field into this record's pending batch.
    const pendingForId = pendingRef.current.get(id) ?? {};
    pendingForId[field] = value;
    pendingRef.current.set(id, pendingForId);

    // 5. (Re)start the per-record debounce timer — multiple edits in quick
    //    succession (e.g. Tab through cells) flush as a single updateRecord call.
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    timersRef.current.set(id, setTimeout(() => { flush(id); }, WRITE_DEBOUNCE_MS));
  }, [applyState, flush]);

  const create = useCallback(async (
    defaults: Partial<Record<string, unknown>>
  ): Promise<string> => {
    try {
      const id = await createRecord(defaults);
      await load();
      return id;
    } catch (err) {
      if (String(err).includes('NO_CONTEXT')) {
        const id = `local-${Date.now()}`;
        const blank: LniRecord = {
          id, job: '', status: 'New Order this week', process: 'Added', priority: '', region: 'WK',
          sales: '', signType: '', location: '', orderDate: new Date().toISOString().slice(0, 10),
          expeditor: '', scheduledInstall: '', mfgTargetMod: '', redDate: '', vendorShipDate: '',
          value: null, dip: null, totalMfg: null, totalInstall: null,
          readyInstall: '?', powerlines: '?', locates: '?', mfgRegion: 'WK', installRegion: 'WK', installArea: 'Wichita Area',
          vendor: '', po: '', vendorStatus: '', graphics: '', routingType: '',
          metal: 'X', assembly: 'X', plex: 'X', paintPrep: 'X', materialCut: 'X',
          paintPrepHrs: null, paintHrs: null, steelHrs: null, installHrs: null, travelHrs: null, routingHrs: null,
          ulSign: false, qt: false, deposit: 'NO', storageLocation: '',
          notes: '', adminNotes: '', mfgNotes: '',
        } as LniRecord;
        const newRec = computeCalcFields({ ...blank, ...defaults } as LniRecord);
        applyState([...recordsRef.current, newRec]);
        return id;
      }
      throw err;
    }
  }, [load, applyState]);

  return {
    state, patch, create, reload: load,
    loadMore, hasMore, loadingMore,
    cellErrors, lastFetched,
  };
}
