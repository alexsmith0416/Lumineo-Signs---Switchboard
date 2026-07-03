// ============================================================
// Dataverse reader — the single seam between this Code App and
// the Power Automate–maintained Dataverse mirror tables
// (docs/18-sign365-api-reference.md §5).
//
// HOW TO WIRE IN POWER PLATFORM (one-time, ~10 min):
//
//   1. From the app root, add each mirror table as a data source:
//        pac code add-data-source -a dataverse -t crfdf_bcjob
//        pac code add-data-source -a dataverse -t crfdf_bcplanningline
//        pac code add-data-source -a dataverse -t crfdf_bccostandsales
//        pac code add-data-source -a dataverse -t crfdf_bctripresource
//        pac code add-data-source -a dataverse -t crfdf_bczipgeo
//        pac code add-data-source -a dataverse -t crfdf_weathercache
//        pac code add-data-source -a dataverse -t crfdf_productionscheduleline
//        pac code add-data-source -a dataverse -t crfdf_installationscheduleline
//        pac code add-data-source -a dataverse -t crfdf_shippingscheduleline
//        pac code add-data-source -a dataverse -t crfdf_employee1
//        pac code add-data-source -a dataverse -t crfdf_department1
//      Each command generates a typed service under src/Services/.
//
//   2. In src/main.tsx (after PowerProvider initializes), register the
//      bridge once:
//
//        import { registerDataverseReader } from "./services/dataverse-reader";
//        import * as Gen from "./Services";        // pac-generated barrel
//
//        registerDataverseReader({
//          async retrieveMultiple(table, options) {
//            const svc = (Gen as any)[`${table}Service`];
//            const res = await svc.getAll({
//              filter: options?.filter,
//              select: options?.select,
//              orderBy: options?.orderBy,
//              top: options?.top,
//            });
//            return res.data ?? res;
//          },
//          async create(table, record) {
//            const svc = (Gen as any)[`${table}Service`];
//            return (await svc.create(record)).data;
//          },
//          async update(table, id, changes) {
//            const svc = (Gen as any)[`${table}Service`];
//            return (await svc.update(id, changes)).data;
//          },
//          async remove(table, id) {
//            const svc = (Gen as any)[`${table}Service`];
//            await svc.delete(id);
//          },
//        });
//
//   3. Done — every service in src/services/* reads through this seam.
//
// In local dev (vite, no Power SDK) the default reader warns once and
// returns empty results, so `npm run dev` still boots.
// ============================================================

export interface RetrieveOptions {
  /** OData $filter body, e.g. `crfdf_jobno eq 'J35899'` */
  filter?: string;
  /** OData $select column list */
  select?: string[];
  /** OData $orderby, e.g. `crfdf_lineno asc` */
  orderBy?: string;
  /** OData $top */
  top?: number;
}

export type DataverseRow = Record<string, unknown>;

export interface DataverseReader {
  retrieveMultiple(table: string, options?: RetrieveOptions): Promise<DataverseRow[]>;
  create(table: string, record: DataverseRow): Promise<DataverseRow>;
  update(table: string, id: string, changes: DataverseRow): Promise<DataverseRow>;
  remove(table: string, id: string): Promise<void>;
}

const WARN_KEY = "__lumineo_stub_warned_dataverse_reader__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[dataverse-reader] No reader registered — running in local-dev mode. " +
      "Reads return []; writes throw. Register the Power SDK bridge in " +
      "main.tsx per src/services/dataverse-reader.ts header comment.",
  );
}

const devFallbackReader: DataverseReader = {
  async retrieveMultiple() {
    warnOnce();
    return [];
  },
  async create() {
    warnOnce();
    throw new Error(
      "[dataverse-reader] create() requires the Power SDK bridge — register it in main.tsx.",
    );
  },
  async update() {
    warnOnce();
    throw new Error(
      "[dataverse-reader] update() requires the Power SDK bridge — register it in main.tsx.",
    );
  },
  async remove() {
    warnOnce();
    throw new Error(
      "[dataverse-reader] remove() requires the Power SDK bridge — register it in main.tsx.",
    );
  },
};

let activeReader: DataverseReader = devFallbackReader;

export function registerDataverseReader(reader: DataverseReader): void {
  activeReader = reader;
}

export function getDataverseReader(): DataverseReader {
  return activeReader;
}

/** True once the Power SDK bridge has been registered. */
export function isDataverseWired(): boolean {
  return activeReader !== devFallbackReader;
}

// ---- shared field helpers (mirror rows come back with crfdf_* logical
// names; older mirror imports may carry legacy names — read defensively) ----

export function str(row: DataverseRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

export function num(row: DataverseRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

export function dateOrNull(row: DataverseRow, ...keys: string[]): Date | null {
  for (const k of keys) {
    const v = row[k];
    if (v instanceof Date) return v;
    if (typeof v === "string" && v) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export function bool(row: DataverseRow, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "boolean") return v;
    if (v === 1 || v === "true" || v === "1") return true;
  }
  return false;
}
