import { useState, useEffect, useCallback, useRef } from 'react';
import type { LniRecord } from '../types/schema';
import { fetchFromAirtable } from '../data/airtable';
import { computeCalcFields } from './calcFields';
import type { DataverseState } from './useDataverse';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAirtable() {
  const [state, setState] = useState<DataverseState>({ status: 'loading' });
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const recordsRef = useRef<LniRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const records = await fetchFromAirtable();
      recordsRef.current = records;
      setState({ status: 'ready', records });
      setLastFetched(new Date());
    } catch (err) {
      setState({ status: 'error', message: String(err) });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  // In-memory optimistic patch — Airtable is read-only in this bridge mode
  const patch = useCallback(async (id: string, field: string, value: unknown) => {
    const updated = recordsRef.current.map(r =>
      r.id !== id ? r : computeCalcFields({ ...r, [field]: value })
    );
    recordsRef.current = updated;
    setState({ status: 'ready', records: updated });
    // No write-back to Airtable — bridge is read-only
  }, []);

  // Create is not supported in bridge mode
  const create = useCallback(async (_defaults: Partial<Record<string, unknown>>): Promise<string> => {
    const id = `at-local-${Date.now()}`;
    const blank: LniRecord = {
      id, job: '', status: 'New Order this week', process: 'Added', priority: '', region: 'WK',
      sales: '', signType: '', location: '', orderDate: new Date().toISOString().slice(0, 10),
      expeditor: '', scheduledInstall: '', mfgTargetMod: '', redDate: '', vendorShipDate: '',
      value: null, dip: null, totalMfg: null, totalInstall: null,
      readyInstall: '?', powerlines: '?', locates: '?', mfgRegion: 'WK', installRegion: 'WK', installArea: 'Wichita Area',
      vendor: '', po: '', vendorStatus: '', graphics: '', routingType: '',
      metal: '', assembly: '', plex: '', paintPrep: '', materialCut: '',
      paintPrepHrs: null, paintHrs: null, steelHrs: null, installHrs: null, travelHrs: null, routingHrs: null,
      ulSign: false, qt: false, deposit: 'NO', storageLocation: '',
      notes: '', adminNotes: '', mfgNotes: '',
    };
    const newRec = computeCalcFields({ ...blank, ..._defaults } as LniRecord);
    recordsRef.current = [...recordsRef.current, newRec];
    setState({ status: 'ready', records: recordsRef.current });
    return id;
  }, []);

  return { state, patch, create, reload: load, lastFetched };
}
