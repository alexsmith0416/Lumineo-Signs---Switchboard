// Local development mock for PowerAppsClientContext.
// This file is only used by Vite dev server via the global shim in main.tsx.
// It is NOT bundled into the Power Apps deployment build.
//
// The mock now emulates Dataverse's OData query handling — $select, $orderby,
// $filter, $top and $skiptoken cursor pagination — so the app exercises the same
// server-side query path in local dev that it uses against real Dataverse.

import type { LniRecord } from '../types/schema';
import { computeCalcFields } from '../hooks/calcFields';
import { runODataQuery, type Entity } from './odataEngine';
import seedJobs from '../data/seed-production-jobs.json';

// Local-dev seed: 728 real jobs from the 6/8/2026 Airtable side-load
// (seed-data/lni-production-schedule/seed-production-jobs.json). This file is
// dev-only and is never bundled into the Power Apps deployment build, where
// PowerAppsClientContext is injected by the host against lni_productionschedule.
const SAMPLE: LniRecord[] = (seedJobs as LniRecord[]).map(computeCalcFields);

let records = [...SAMPLE];
let nextId = 100;

const PRIMARY_KEY = 'lni_productionscheduleid';

// Run an OData query against the current in-memory record set.
function runQuery(query: string) {
  const entities: Entity[] = records.map(r => ({ [PRIMARY_KEY]: r.id, ...toEntity(r) }));
  return runODataQuery(entities, query, PRIMARY_KEY);
}

// Injected into window so PowerAppsClientContext declarations resolve at runtime.
// Guarded so the module can also be imported in a non-browser (test) context.
if (typeof window !== 'undefined')
(window as unknown as Record<string, unknown>)['PowerAppsClientContext'] = {
  get() {
    return {
      userSettings: { userId: 'dev-user-001' },
      webAPI: {
        async retrieveMultipleRecords(_table: string, query: string) {
          return runQuery(query ?? '');
        },
        async updateRecord(_table: string, id: string, data: Record<string, unknown>) {
          records = records.map(r => {
            if (r.id !== id) return r;
            const patch: Record<string, unknown> = {};
            for (const [col, val] of Object.entries(data)) {
              const key = COL_TO_KEY[col];
              if (key) patch[key] = val;
            }
            return computeCalcFields({ ...r, ...patch } as LniRecord);
          });
        },
        async createRecord(_table: string, data: Record<string, unknown>) {
          const id = String(++nextId);
          const patch: Record<string, unknown> = { id };
          for (const [col, val] of Object.entries(data)) {
            const key = COL_TO_KEY[col];
            if (key) patch[key] = val;
          }
          const newRec = computeCalcFields({ ...blankRecord(id), ...patch } as LniRecord);
          records = [...records, newRec];
          return { id };
        },
      },
    };
  },
};

function blankRecord(id: string): LniRecord {
  return {
    id, job:'', status:'New Order this week', process:'Added', priority:'', region:'WK',
    sales:'', signType:'', location:'', orderDate: new Date().toISOString().slice(0,10),
    expeditor:'', scheduledInstall:'', mfgTargetMod:'', redDate:'', vendorShipDate:'',
    value:null, dip:null, totalMfg:null, totalInstall:null,
    readyInstall:'?', powerlines:'?', locates:'?', mfgRegion:'WK', installRegion:'WK', installArea:'Wichita Area',
    vendor:'', po:'', vendorStatus:'', graphics:'', routingType:'',
    metal:'X', assembly:'X', plex:'X', paintPrep:'X', materialCut:'X',
    paintPrepHrs:null, paintHrs:null, steelHrs:null, installHrs:null, travelHrs:null, routingHrs:null,
    ulSign:false, qt:false, deposit:'NO', storageLocation:'',
    notes:'', adminNotes:'', mfgNotes:'',
  } as LniRecord;
}

function toEntity(r: LniRecord): Record<string, unknown> {
  return {
    lni_current_status: r.status, lni_process: r.process, lni_priority: r.priority,
    lni_region: r.region, lni_sales: r.sales, lni_sign_types: r.signType, lni_location: r.location,
    lni_order_date: r.orderDate, lni_expeditor: r.expeditor, lni_scheduled_install: r.scheduledInstall,
    lni_mfg_target_modified: r.mfgTargetMod, lni_red_date: r.redDate, lni_vendor_ship_date: r.vendorShipDate,
    lni_value: r.value, lni_ready_for_install: r.readyInstall, lni_powerlines: r.powerlines,
    lni_locates: r.locates, lni_mfg_region: r.mfgRegion, lni_install_region: r.installRegion,
    lni_install_area: r.installArea, lni_vendor: r.vendor, lni_po_number: r.po,
    lni_vendor_status: r.vendorStatus, lni_graphics: r.graphics, lni_routing_type: r.routingType,
    lni_metal: r.metal, lni_assembly: r.assembly, lni_plex_application: r.plex,
    lni_paint_prep_paint: r.paintPrep, lni_material_cut: r.materialCut,
    lni_paint_prep_hrs: r.paintPrepHrs, lni_paint_hrs: r.paintHrs, lni_steel_hrs: r.steelHrs,
    lni_install_hrs: r.installHrs, lni_travel_hrs: r.travelHrs, lni_routing_hrs: r.routingHrs,
    lni_ul_sign: r.ulSign, lni_qt: r.qt, lni_deposit: r.deposit, lni_storage_location: r.storageLocation,
    lni_name: r.job,
    lni_job_notes: r.notes, lni_admin_notes: r.adminNotes, lni_mfg_notes: r.mfgNotes,
  };
}

const COL_TO_KEY: Record<string, string> = {
  lni_name:'job', lni_current_status:'status', lni_process:'process', lni_priority:'priority',
  lni_region:'region', lni_sales:'sales', lni_sign_types:'signType', lni_location:'location',
  lni_order_date:'orderDate', lni_expeditor:'expeditor', lni_scheduled_install:'scheduledInstall',
  lni_mfg_target_modified:'mfgTargetMod', lni_red_date:'redDate', lni_vendor_ship_date:'vendorShipDate',
  lni_value:'value', lni_ready_for_install:'readyInstall', lni_powerlines:'powerlines',
  lni_locates:'locates', lni_mfg_region:'mfgRegion', lni_install_region:'installRegion',
  lni_install_area:'installArea', lni_vendor:'vendor', lni_po_number:'po',
  lni_vendor_status:'vendorStatus', lni_graphics:'graphics', lni_routing_type:'routingType',
  lni_metal:'metal', lni_assembly:'assembly', lni_plex_application:'plex',
  lni_paint_prep_paint:'paintPrep', lni_material_cut:'materialCut',
  lni_paint_prep_hrs:'paintPrepHrs', lni_paint_hrs:'paintHrs', lni_steel_hrs:'steelHrs',
  lni_install_hrs:'installHrs', lni_travel_hrs:'travelHrs', lni_routing_hrs:'routingHrs',
  lni_ul_sign:'ulSign', lni_qt:'qt', lni_deposit:'deposit', lni_storage_location:'storageLocation',
  lni_job_notes:'notes', lni_admin_notes:'adminNotes', lni_mfg_notes:'mfgNotes',
};
