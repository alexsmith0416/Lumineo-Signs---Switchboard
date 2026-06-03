// Serves the bundled CSV snapshot as the data source.
// Used for demos / when Airtable and Dataverse are unavailable.
import { useState, useCallback } from 'react';
import type { LniRecord } from '../types/schema';
import { STATIC_RECORDS } from '../data/staticRecords';
import { computeCalcFields } from './calcFields';
import type { DataverseState } from './useDataverse';

// Compute calc fields once at module load — not on every render
const BASE_RECORDS: LniRecord[] = STATIC_RECORDS.map(r => computeCalcFields(r));

export function useStaticData() {
  const [records, setRecords] = useState<LniRecord[]>(BASE_RECORDS);
  const state: DataverseState = { status: 'ready', records };

  // Optimistic in-memory patch (changes don't persist across reload — that's fine for demo)
  const patch = useCallback(async (id: string, field: string, value: unknown) => {
    setRecords(prev =>
      prev.map(r => r.id !== id ? r : computeCalcFields({ ...r, [field]: value }))
    );
  }, []);

  // In-memory create
  const create = useCallback(async (defaults: Partial<Record<string, unknown>>): Promise<string> => {
    const id = `demo-${Date.now()}`;
    const blank: LniRecord = {
      id, job: '', status: 'New Order this week', process: 'Added', priority: '', region: 'WK',
      sales: '', signType: '', location: '', orderDate: new Date().toISOString().slice(0, 10),
      expeditor: '', scheduledInstall: '', mfgTargetMod: '', redDate: '', vendorShipDate: '',
      value: null, dip: null, totalMfg: null, totalInstall: null,
      readyInstall: '', powerlines: '', locates: '', mfgRegion: 'WK', installRegion: 'WK', installArea: '',
      vendor: '', po: '', vendorStatus: '', graphics: '', routingType: '',
      metal: '', assembly: '', plex: '', paintPrep: '', materialCut: '',
      paintPrepHrs: null, paintHrs: null, steelHrs: null, installHrs: null, travelHrs: null, routingHrs: null,
      ulSign: false, qt: false, deposit: '', storageLocation: '',
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
    const newRec = computeCalcFields({ ...blank, ...defaults } as LniRecord);
    setRecords(prev => [newRec, ...prev]);
    return id;
  }, []);

  return { state, patch, create };
}
