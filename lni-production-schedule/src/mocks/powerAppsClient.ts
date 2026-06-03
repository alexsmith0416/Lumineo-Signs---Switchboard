// Local development mock for PowerAppsClientContext.
// This file is only used by Vite dev server via the global shim in main.tsx.
// It is NOT bundled into the Power Apps deployment build.

import type { LniRecord } from '../types/schema';
import { computeCalcFields } from '../hooks/calcFields';

const SAMPLE: LniRecord[] = [
  {
    id:'1', job:'LNI-2025-001 / Equity Bank Main', sales:'AS', region:'WK', location:'Wichita, KS',
    status:'Manufacturing', process:'In Process', priority:'Rush', signType:'Monument',
    readyInstall:'NO', powerlines:'?', locates:'?', mfgRegion:'WK', installRegion:'WK', installArea:'Wichita Area',
    orderDate:'2025-04-01', expeditor:'2025-04-05', scheduledInstall:'2025-06-15',
    value:12500, dip:null, totalMfg:null, totalInstall:null,
    vendor:'GEMINI', vendorStatus:'ORDERED', graphics:'Here/Ready', routingType:'Metal & Backed',
    metal:'/', assembly:'/', plex:'/', paintPrep:'/', materialCut:'/',
    notes:'Awaiting routing completion', mfgNotes:'', adminNotes:'', redDate:'',
    deposit:'YES', ulSign:false, qt:false,
    steelHrs:8, installHrs:16, travelHrs:4, paintPrepHrs:6, paintHrs:8, routingHrs:4,
    po:'PO-2025-001', vendorShipDate:'2025-05-20', mfgTargetMod:'', storageLocation:'',
  },
  {
    id:'2', job:'LNI-2025-002 / First National Bank', sales:'DW', region:'WK', location:'Hutchinson, KS',
    status:'Hold - Permit', process:'Hold', priority:'SIP', signType:'Pylon',
    readyInstall:'Survey needed', powerlines:'YES', locates:'Needed', mfgRegion:'WK', installRegion:'WK', installArea:'Hutchinson Area',
    orderDate:'2025-03-15', expeditor:'2025-03-22', scheduledInstall:'2025-07-01',
    value:45000, dip:null, totalMfg:null, totalInstall:null,
    vendor:'WATCHFIRE', vendorStatus:'RECEIVED', graphics:'Lawrence', routingType:'Metal w/ Push Thru',
    metal:'/', assembly:'X', plex:'/', paintPrep:'/', materialCut:'/',
    notes:'Permit pending city approval', mfgNotes:'Steel fab ready', adminNotes:'', redDate:'',
    deposit:'NO', ulSign:true, qt:false,
    steelHrs:24, installHrs:32, travelHrs:8, paintPrepHrs:12, paintHrs:16, routingHrs:8,
    po:'PO-2025-002', vendorShipDate:'2025-04-10', mfgTargetMod:'', storageLocation:'Warehouse - Floor',
  },
  {
    id:'3', job:'LNI-2025-003 / Dillons Grocery #5', sales:'TC', region:'NEK', location:'Lawrence, KS',
    status:'Complete Invoiced', process:'Invoiced', priority:'', signType:'Channel Letter',
    readyInstall:'YES', powerlines:'N/A', locates:'N/A', mfgRegion:'NEK', installRegion:'NEK', installArea:'NEK INSTALL',
    orderDate:'2025-02-10', expeditor:'2025-02-18', scheduledInstall:'2025-04-20',
    value:8750, dip:null, totalMfg:null, totalInstall:null,
    vendor:'SIGN HOUSE', vendorStatus:'RECEIVED', graphics:'Complete', routingType:'1/2 Plex',
    metal:'X', assembly:'/', plex:'/', paintPrep:'/', materialCut:'/',
    notes:'', mfgNotes:'Complete', adminNotes:'Invoiced 4/22', redDate:'',
    deposit:'YES', ulSign:false, qt:true,
    steelHrs:0, installHrs:8, travelHrs:6, paintPrepHrs:4, paintHrs:6, routingHrs:0,
    po:'PO-2025-003', vendorShipDate:'2025-03-28', mfgTargetMod:'', storageLocation:'',
  },
  {
    id:'4', job:'LNI-2025-004 / Meritrust CU - West', sales:'NH', region:'WK', location:'Wichita, KS',
    status:'MFG - Routing', process:'In Process', priority:'RED DATE', signType:'ID Cabinet',
    readyInstall:'N/A', powerlines:'?', locates:'?', mfgRegion:'WK', installRegion:'WK', installArea:'Wichita Area',
    orderDate:'2025-04-10', expeditor:'2025-04-14', scheduledInstall:'2025-06-01',
    value:22300, dip:null, totalMfg:null, totalInstall:null,
    vendor:'GREGORY', vendorStatus:'SHIPPING', graphics:'Hutch', routingType:'Metal & Plex',
    metal:'/', assembly:'/', plex:'/', paintPrep:'/', materialCut:'/',
    notes:'RED DATE hard deadline 6/1', mfgNotes:'Routing in progress', adminNotes:'', redDate:'2025-06-01',
    deposit:'YES', ulSign:true, qt:false,
    steelHrs:16, installHrs:20, travelHrs:4, paintPrepHrs:8, paintHrs:10, routingHrs:12,
    po:'PO-2025-004', vendorShipDate:'2025-05-15', mfgTargetMod:'2025-05-25', storageLocation:'Bus Barn - Floor',
  },
  {
    id:'5', job:'LNI-2025-005 / USD 259 Admin Bldg', sales:'VB', region:'WK', location:'Wichita, KS',
    status:'Active', process:'In Process', priority:'', signType:'Flat Aluminum',
    readyInstall:'N/A', powerlines:'N/A', locates:'N/A', mfgRegion:'WK', installRegion:'WK', installArea:'Wichita Area',
    orderDate:'2025-04-20', expeditor:'2025-04-25', scheduledInstall:'2025-07-10',
    value:5400, dip:null, totalMfg:null, totalInstall:null,
    vendor:'GEMINI', vendorStatus:'ORDERED', graphics:'Outsourced', routingType:'Metal Only',
    metal:'X', assembly:'/', plex:'/', paintPrep:'X', materialCut:'/',
    notes:'', mfgNotes:'', adminNotes:'', redDate:'',
    deposit:'in process', ulSign:false, qt:false,
    steelHrs:4, installHrs:8, travelHrs:2, paintPrepHrs:0, paintHrs:0, routingHrs:0,
    po:'', vendorShipDate:'', mfgTargetMod:'', storageLocation:'',
  },
].map(computeCalcFields);

let records = [...SAMPLE];
let nextId = 100;

// Injected into window so PowerAppsClientContext declarations resolve at runtime
(window as unknown as Record<string, unknown>)['PowerAppsClientContext'] = {
  get() {
    return {
      userSettings: { userId: 'dev-user-001' },
      webAPI: {
        async retrieveMultipleRecords(_table: string, _query: string) {
          return { entities: records.map(r => ({ lni_productionscheduleid: r.id, ...toEntity(r) })) };
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
  };
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
