export type FieldType =
  | 'text'
  | 'multiline'
  | 'select'
  | 'date'
  | 'number'
  | 'currency'
  | 'bool'
  | 'readonly';

export interface FieldDef {
  key: string;
  label: string;
  dvColumn: string;
  type: FieldType;
  width: number;
  opts?: string[];
}

export type CustomFieldType =
  | 'text'
  | 'multiline'
  | 'number'
  | 'currency'
  | 'date'
  | 'bool'
  | 'select'
  | 'url'
  | 'email'
  | 'phone'
  | 'formula-date';

export interface FormulaDateConfig {
  baseField: string;  // key of LniRecord date field e.g. 'orderDate'
  offset: number;     // integer
  unit: 'days' | 'weeks';
}

export interface CustomFieldDef {
  key: string;           // "cf_<timestamp>"
  label: string;
  type: CustomFieldType;
  width: number;
  opts?: string[];       // for select type
  formulaConfig?: FormulaDateConfig;
}

export interface LniRecord {
  id: string;

  // Core identity
  job: string;
  status: string;
  process: string;
  priority: string;
  region: string;
  sales: string;
  signType: string;
  location: string;

  // Dates
  orderDate: string;
  expeditor: string;
  scheduledInstall: string;
  mfgTargetMod: string;
  redDate: string;
  vendorShipDate: string;

  // Financials
  value: number | null;

  // Calculated (client-side, never written to Dataverse)
  dip: number | null;
  totalMfg: number | null;
  totalInstall: number | null;

  // Install readiness
  readyInstall: string;
  powerlines: string;
  locates: string;

  // Regions
  mfgRegion: string;
  installRegion: string;
  installArea: string;

  // Vendor
  vendor: string;
  po: string;
  vendorStatus: string;

  // MFG stage fields
  graphics: string;
  routingType: string;
  metal: string;
  assembly: string;
  plex: string;
  paintPrep: string;
  materialCut: string;

  // Hours
  paintPrepHrs: number | null;
  paintHrs: number | null;
  steelHrs: number | null;
  installHrs: number | null;
  travelHrs: number | null;
  routingHrs: number | null;

  // Booleans
  ulSign: boolean;
  qt: boolean;
  deposit: string;

  // Storage
  storageLocation: string;

  // Notes / description
  notes: string;
  adminNotes: string;
  mfgNotes: string;
  description: string;

  // Additional date tracking
  mfgFinalDate: string;
  dateToHold: string;
  dateOffHold: string;
  dateInstalled: string;
  dateToAdmin: string;
  vendorShipDate2: string;
  outsourcedArrival: string;
  paintPrepDueMod: string;

  // Additional MFG fields
  cutVinylColor: string;
  vinylProd: string;

  // Scheduling dates
  mfgTarget: string;
  installTarget: string;
  billDayJob: string;

  // Workflow tracking
  sketch: string;          // attachment URL (read-only display)
  routingOrdered: string;
  vinylOrdered: string;
  vinylComplete: string;
  routingComplete: string;
  mfgComplete: string;
  dateInvoiced: string;
  vinylDueDate: string;
  vinylProdStartDate: string;

  // Notes / supplemental
  graphicsNotes: string;
  emcContent: string;
  mfgRating: string;

  // DIP sub-metrics
  adjustedDip: number | null;
  mfgDip: number | null;
}

export type RecordType = 'Active' | 'Completed';
