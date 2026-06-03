import type { LniRecord } from '../types/schema';
import { computeCalcFields } from '../hooks/calcFields';

const BASE_ID = 'appjphchC6hRzfkMi';
const TABLE_ID = 'tbleMDRECIBmBAOM8';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// Airtable REST API returns singleSelect as string, multipleSelects as string[].
// Take first element for multi-selects that map to single-value app fields.
function str(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return String((v as string[])[0] ?? '');
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function mapRecord(r: AirtableRecord): LniRecord {
  const f = r.fields;
  return computeCalcFields({
    id: r.id,
    job:             str(f['Job # / Name']),
    status:          str(f['Current Status']),
    process:         str(f['Process']),
    priority:        str(f['Priority']),
    region:          str(f['Region']),
    sales:           str(f['Sales']),
    signType:        str(f['Sign Types']),
    location:        str(f['Location']),
    orderDate:       str(f['Order Date (Received)']),
    expeditor:       str(f['Expeditor']),
    scheduledInstall: str(f['Scheduled Install']),
    mfgTargetMod:    str(f['Mfg Target Modified']),
    redDate:         str(f['RED DATE']),
    vendorShipDate:  str(f['Vendor Ship Date']),
    value:           num(f['Value']),
    dip:             null, // computed by computeCalcFields
    totalMfg:        num(f['Total Hrs Mfg']),
    totalInstall:    num(f['Total Hrs Install']),
    readyInstall:    str(f['Ready for Install']),
    powerlines:      str(f['Powerlines']),
    locates:         str(f['Locates']),
    mfgRegion:       str(f['MFG Region']),
    installRegion:   str(f['Install Region']),
    installArea:     str(f['Install Area']),
    vendor:          str(f['Vendor']),
    po:              str(f['P.O. #']),
    vendorStatus:    str(f['Vendor Status']),
    graphics:        str(f['Graphics']),
    routingType:     str(f['Routing Type']),
    metal:           str(f['Metal']),
    assembly:        str(f['Assembly']),
    plex:            str(f['Plex/Application']),
    paintPrep:       str(f['Paint Prep/Paint']),
    materialCut:     str(f['Material Cut']),
    paintPrepHrs:    num(f['Paint Prep']),
    paintHrs:        num(f['Paint']),
    steelHrs:        num(f['Steel']),
    installHrs:      num(f['Install']),
    travelHrs:       num(f['Travel']),
    routingHrs:      num(f['Routing Hrs']),
    ulSign:          Boolean(f['UL Sign']),
    qt:              Boolean(f['Q.T.']),
    deposit:         str(f['Deposit']),
    storageLocation: str(f['Storage Location']),
    notes:           str(f['Job Notes']),
    adminNotes:      str(f['Admin Notes']),
    mfgNotes:        str(f['Mfg Notes']),
    description:     str(f['Description']),
    mfgFinalDate:    str(f['Mfg Final Date']),
    dateToHold:      str(f['Date to Hold']),
    dateOffHold:     str(f['Date off Hold']),
    dateInstalled:   str(f['Date Installed']),
    dateToAdmin:     str(f['Date to Admin']),
    vendorShipDate2: str(f['2nd Vendor Ship Date']),
    outsourcedArrival: str(f['Outsourced Arrival']),
    paintPrepDueMod: str(f['Paint Prep/Paint - Due Date Modified']),
    cutVinylColor:   str(f['Cut Vinyl Color']),
    vinylProd:       str(f['Vinyl Prod / Install/ Patterns']),
  });
}

export async function fetchFromAirtable(): Promise<LniRecord[]> {
  const records: LniRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`/api/airtable/v0/${BASE_ID}/${TABLE_ID}`, window.location.origin);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('sort[0][field]', 'Order Date (Received)');
    url.searchParams.set('sort[0][direction]', 'desc');
    if (offset) url.searchParams.set('offset', offset);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable error ${resp.status}: ${text}`);
    }
    const data = await resp.json() as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records.map(mapRecord));
    offset = data.offset;
  } while (offset);

  return records;
}
