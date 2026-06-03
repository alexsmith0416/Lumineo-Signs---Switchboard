import type { LniRecord } from '../types/schema';

// Power Apps Code App client — injected at runtime by the Power Apps host.
// When running locally (Vite dev server) this module is mocked via src/mocks/powerAppsClient.ts.
declare const PowerAppsClientContext: {
  get(): {
    webAPI: {
      retrieveMultipleRecords(
        entityName: string,
        options: string
      ): Promise<{ entities: Record<string, unknown>[] }>;
      updateRecord(
        entityName: string,
        id: string,
        data: Record<string, unknown>
      ): Promise<void>;
      createRecord(
        entityName: string,
        data: Record<string, unknown>
      ): Promise<{ id: string }>;
    };
    userSettings: {
      userId: string;
    };
  };
};

const TABLE = 'lni_productionschedule';

type PacContext = ReturnType<typeof PowerAppsClientContext.get>;

// Attempt to find the Power Apps client context on window.
// PowerAppsClientContext is only available in PCF/Canvas components, not Code Apps.
// This function tries known globals and logs diagnostics if none found.
export async function getContext(): Promise<PacContext> {
  const win = window as unknown as Record<string, unknown>;

  // Log available Power Platform globals once on first call (production diagnostic)
  if (typeof win['__lni_ctxDiag'] === 'undefined') {
    win['__lni_ctxDiag'] = true;
    const hits = Object.keys(win).filter(k =>
      /power|xrm|crm|dynamics|client.*context/i.test(k)
    );
    console.info('[LNI] Power Platform globals on window:', hits.length ? hits : '(none found)');
  }

  const ctx = win['PowerAppsClientContext'] as typeof PowerAppsClientContext | undefined;
  if (ctx) return ctx.get();

  throw new Error('NO_CONTEXT');
}

function mapFromDV(entity: Record<string, unknown>): LniRecord {
  const n = (k: string) => (entity[k] as number | null) ?? null;
  const s = (k: string) => (entity[k] as string | null) ?? '';
  const b = (k: string) => Boolean(entity[k]);

  return {
    id:              entity['lni_productionscheduleid'] as string,
    job:             s('lni_name'),
    status:          s('lni_current_status'),
    process:         s('lni_process'),
    priority:        s('lni_priority'),
    region:          s('lni_region'),
    sales:           s('lni_sales'),
    signType:        s('lni_sign_types'),
    location:        s('lni_location'),
    orderDate:       s('lni_order_date'),
    expeditor:       s('lni_expeditor'),
    scheduledInstall:s('lni_scheduled_install'),
    mfgTargetMod:    s('lni_mfg_target_modified'),
    redDate:         s('lni_red_date'),
    vendorShipDate:  s('lni_vendor_ship_date'),
    value:           n('lni_value'),
    dip:             null,       // computed client-side
    totalMfg:        null,       // computed client-side
    totalInstall:    null,       // computed client-side
    readyInstall:    s('lni_ready_for_install'),
    powerlines:      s('lni_powerlines'),
    locates:         s('lni_locates'),
    mfgRegion:       s('lni_mfg_region'),
    installRegion:   s('lni_install_region'),
    installArea:     s('lni_install_area'),
    vendor:          s('lni_vendor'),
    po:              s('lni_po_number'),
    vendorStatus:    s('lni_vendor_status'),
    graphics:        s('lni_graphics'),
    routingType:     s('lni_routing_type'),
    metal:           s('lni_metal'),
    assembly:        s('lni_assembly'),
    plex:            s('lni_plex_application'),
    paintPrep:       s('lni_paint_prep_paint'),
    materialCut:     s('lni_material_cut'),
    paintPrepHrs:    n('lni_paint_prep_hrs'),
    paintHrs:        n('lni_paint_hrs'),
    steelHrs:        n('lni_steel_hrs'),
    installHrs:      n('lni_install_hrs'),
    travelHrs:       n('lni_travel_hrs'),
    routingHrs:      n('lni_routing_hrs'),
    ulSign:          b('lni_ul_sign'),
    qt:              b('lni_qt'),
    deposit:         s('lni_deposit'),
    storageLocation: s('lni_storage_location'),
    notes:           s('lni_job_notes'),
    adminNotes:      s('lni_admin_notes'),
    mfgNotes:        s('lni_mfg_notes'),
  };
}

// Maps an app field key + value to the Dataverse column name for writes.
// Only writable fields are included — calculated (dip, totalMfg, totalInstall) are excluded.
const DV_COLUMN: Record<string, string> = {
  job:             'lni_name',
  status:          'lni_current_status',
  process:         'lni_process',
  priority:        'lni_priority',
  region:          'lni_region',
  sales:           'lni_sales',
  signType:        'lni_sign_types',
  location:        'lni_location',
  orderDate:       'lni_order_date',
  expeditor:       'lni_expeditor',
  scheduledInstall:'lni_scheduled_install',
  mfgTargetMod:    'lni_mfg_target_modified',
  redDate:         'lni_red_date',
  vendorShipDate:  'lni_vendor_ship_date',
  value:           'lni_value',
  readyInstall:    'lni_ready_for_install',
  powerlines:      'lni_powerlines',
  locates:         'lni_locates',
  mfgRegion:       'lni_mfg_region',
  installRegion:   'lni_install_region',
  installArea:     'lni_install_area',
  vendor:          'lni_vendor',
  po:              'lni_po_number',
  vendorStatus:    'lni_vendor_status',
  graphics:        'lni_graphics',
  routingType:     'lni_routing_type',
  metal:           'lni_metal',
  assembly:        'lni_assembly',
  plex:            'lni_plex_application',
  paintPrep:       'lni_paint_prep_paint',
  materialCut:     'lni_material_cut',
  paintPrepHrs:    'lni_paint_prep_hrs',
  paintHrs:        'lni_paint_hrs',
  steelHrs:        'lni_steel_hrs',
  installHrs:      'lni_install_hrs',
  travelHrs:       'lni_travel_hrs',
  routingHrs:      'lni_routing_hrs',
  ulSign:          'lni_ul_sign',
  qt:              'lni_qt',
  deposit:         'lni_deposit',
  storageLocation: 'lni_storage_location',
  notes:           'lni_job_notes',
  adminNotes:      'lni_admin_notes',
  mfgNotes:        'lni_mfg_notes',
};

export async function fetchRecords(filter?: string): Promise<LniRecord[]> {
  const client = await getContext();
  const filterClause = filter ? `&$filter=${encodeURIComponent(filter)}` : '';
  const result = await client.webAPI.retrieveMultipleRecords(
    TABLE,
    `?$orderby=lni_order_date desc&$top=500${filterClause}`
  );
  return result.entities.map(mapFromDV);
}

export async function patchRecord(
  id: string,
  field: string,
  value: unknown
): Promise<void> {
  const dvColumn = DV_COLUMN[field];
  if (!dvColumn) return; // readonly / calculated field — skip
  const client = await getContext();
  await client.webAPI.updateRecord(TABLE, id, { [dvColumn]: value });
}

export async function createRecord(
  defaults: Partial<Record<string, unknown>>
): Promise<string> {
  const client = await getContext();
  const dvData: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(defaults)) {
    const col = DV_COLUMN[key];
    if (col) dvData[col] = val;
  }
  const result = await client.webAPI.createRecord(TABLE, dvData);
  return result.id;
}

export async function getCurrentUserId(): Promise<string> {
  const client = await getContext();
  return client.userSettings.userId;
}
