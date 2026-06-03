import { useState, useEffect, useCallback, useRef } from 'react';
import type { LniRecord } from '../types/schema';
import { fetchRecords, patchRecord, createRecord } from '../data/dataverse';
import { computeCalcFields } from './calcFields';

export type DataverseState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: LniRecord[] };

export function useDataverse() {
  const [state, setState] = useState<DataverseState>({ status: 'loading' });
  // Keep a mutable ref so patch callbacks always see latest records
  const recordsRef = useRef<LniRecord[]>([]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const raw = await fetchRecords();
      const records = raw.map(computeCalcFields);
      recordsRef.current = records;
      setState({ status: 'ready', records });
    } catch (err) {
      const msg = String(err);
      // NO_CONTEXT = running outside Power Apps (Code App without host injection).
      // Show empty ready state so the UI is usable; data integration is pending.
      if (msg.includes('NO_CONTEXT')) {
        recordsRef.current = [];
        setState({ status: 'ready', records: [] });
      } else {
        setState({ status: 'error', message: msg });
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback(async (
    id: string,
    field: string,
    value: unknown
  ) => {
    // Optimistic update: reflect the change locally before the network call
    const updated = recordsRef.current.map(r => {
      if (r.id !== id) return r;
      return computeCalcFields({ ...r, [field]: value });
    });
    recordsRef.current = updated;
    setState({ status: 'ready', records: updated });

    try {
      await patchRecord(id, field, value);
    } catch (err) {
      if (!String(err).includes('NO_CONTEXT')) await load(); // revert on real errors only
    }
  }, [load]);

  const create = useCallback(async (
    defaults: Partial<Record<string, unknown>>
  ): Promise<string> => {
    try {
      const id = await createRecord(defaults);
      await load();
      return id;
    } catch (err) {
      if (String(err).includes('NO_CONTEXT')) {
        // No backend — generate a local id and add in-memory
        const id = `local-${Date.now()}`;
        const blank: import('../types/schema').LniRecord = {
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
          description: '', mfgFinalDate: '', dateToHold: '', dateOffHold: '',
          dateInstalled: '', dateToAdmin: '', vendorShipDate2: '', outsourcedArrival: '',
          paintPrepDueMod: '', cutVinylColor: '', vinylProd: '',
          mfgTarget: '', installTarget: '', billDayJob: '',
          sketch: '', routingOrdered: '', vinylOrdered: '', vinylComplete: '',
          routingComplete: '', mfgComplete: '', dateInvoiced: '', vinylDueDate: '', vinylProdStartDate: '',
          graphicsNotes: '', emcContent: '', mfgRating: '',
          adjustedDip: null, mfgDip: null,
        };
        const newRec = computeCalcFields({ ...blank, ...defaults } as import('../types/schema').LniRecord);
        recordsRef.current = [...recordsRef.current, newRec];
        setState({ status: 'ready', records: recordsRef.current });
        return id;
      }
      throw err;
    }
  }, [load]);

  return { state, patch, create, reload: load };
}
