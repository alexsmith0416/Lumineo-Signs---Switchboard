// Dataverse adapter — runtime-bound to the Power Apps Code apps SDK.
//
// `pac code init` injects a typed Dataverse client at runtime via the global
// PowerProvider that the published bundle expects. When the SDK isn't
// available (local `vite dev`, Storybook, unit tests) the repo factory falls
// back to localStorage so the rest of the app keeps working unchanged.
//
// The Sign Specifications table binding is declared in `app/power.config.json`
// under `tables[].alias = "SignSpecifications"`, so once the bundle is hosted
// the table client is reachable at `PowerProvider.tables.SignSpecifications`.

import type { SignSpec } from "../domain/SignSpec";
import type { SignSpecRepo } from "./dataverseService";
import { localSignSpecRepo } from "./dataverseService";

type DataverseColumns = Record<string, string | number | boolean | null>;

type PowerProviderTable<T extends DataverseColumns> = {
  list(): Promise<T[]>;
  create(row: T): Promise<T>;
  update(id: string, row: Partial<T>): Promise<T>;
  retrieve(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
};

type PowerProviderShape = {
  tables: {
    SignSpecifications?: PowerProviderTable<DataverseColumns>;
  };
};

declare global {
  interface Window {
    PowerProvider?: PowerProviderShape;
  }
}

export type DataBackend = "dataverse" | "local";

export function detectDataBackend(): DataBackend {
  const provider = typeof window !== "undefined" ? window.PowerProvider : undefined;
  return provider?.tables?.SignSpecifications ? "dataverse" : "local";
}

// Maps the in-app SignSpec to the Dataverse row shape (logical column names).
// Kept in one place so the adapter is the single seam between domain types
// and the Power Platform schema.
function toRow(spec: SignSpec): DataverseColumns {
  return {
    lum_productcode:     spec.productCode,
    lum_customername:    spec.customerName,
    lum_projectname:     spec.projectName,
    lum_quantity:        spec.quantity,
    lum_signtypecode:    spec.signTypeCode,
    lum_faces:           spec.faces,
    lum_illumination:    spec.illumination,
    lum_ledcolorcode:    spec.ledColor,
    lum_facetypecode:    spec.faceType,
    lum_finishcode:      spec.finish,
    lum_paintcolor:      spec.paintColor,
    lum_vinylcode:       spec.vinyl,
    lum_vinylcolor:      spec.vinylColor,
    lum_vinylhex:        spec.vinylHex,
    lum_mountingcode:    spec.mounting,
    lum_heightin:        spec.heightIn ? Number(spec.heightIn) : null,
    lum_widthin:         spec.widthIn  ? Number(spec.widthIn)  : null,
    lum_depthin:         spec.depthIn  ? Number(spec.depthIn)  : null,
    lum_backertype:      spec.backerType,
    lum_backercolor:     spec.backerColor,
    lum_poletype:        spec.poleType,
    lum_polediameter:    spec.poleDiameter,
    lum_polematerial:    spec.poleMaterial,
    lum_footingtype:     spec.footingType,
    lum_footingdepth:    spec.footingDepth,
    lum_footingmethod:   spec.footingMethod,
    lum_electrical:      spec.electrical,
    lum_conduitsize:     spec.conduitSize,
    lum_panellocation:   spec.panelLocation,
    lum_departments:     spec.departments,
    lum_outsourced:      spec.outsourced,
    lum_notes:           spec.notes,
    lum_status:          statusToOptionSet(spec.status),
  };
}

function fromRow(row: DataverseColumns): SignSpec {
  return {
    id:            String(row.signspecificationid ?? row.id ?? ""),
    productCode:   String(row.lum_productcode ?? ""),
    customerName:  String(row.lum_customername ?? ""),
    projectName:   String(row.lum_projectname ?? ""),
    quantity:      Number(row.lum_quantity ?? 1),
    signTypeCode:  (String(row.lum_signtypecode ?? "")) as SignSpec["signTypeCode"],
    faces:         (String(row.lum_faces ?? "")) as SignSpec["faces"],
    illumination:  (String(row.lum_illumination ?? "")) as SignSpec["illumination"],
    ledColor:      (String(row.lum_ledcolorcode ?? "WH")) as SignSpec["ledColor"],
    faceType:      (String(row.lum_facetypecode ?? "")) as SignSpec["faceType"],
    finish:        (String(row.lum_finishcode ?? "")) as SignSpec["finish"],
    paintColor:    String(row.lum_paintcolor ?? ""),
    vinyl:         (String(row.lum_vinylcode ?? "")) as SignSpec["vinyl"],
    vinylColor:    String(row.lum_vinylcolor ?? ""),
    vinylHex:      String(row.lum_vinylhex ?? ""),
    digitalRef:    "",
    mounting:      (String(row.lum_mountingcode ?? "")) as SignSpec["mounting"],
    heightIn:      row.lum_heightin == null ? "" : String(row.lum_heightin),
    widthIn:       row.lum_widthin  == null ? "" : String(row.lum_widthin),
    depthIn:       row.lum_depthin  == null ? "" : String(row.lum_depthin),
    backerType:    (String(row.lum_backertype ?? "")) as SignSpec["backerType"],
    backerColor:   String(row.lum_backercolor ?? ""),
    poleType:      String(row.lum_poletype ?? ""),
    poleDiameter:  String(row.lum_polediameter ?? ""),
    poleMaterial:  String(row.lum_polematerial ?? ""),
    footingType:   String(row.lum_footingtype ?? ""),
    footingDepth:  String(row.lum_footingdepth ?? ""),
    footingMethod: String(row.lum_footingmethod ?? ""),
    electrical:    String(row.lum_electrical ?? ""),
    conduitSize:   String(row.lum_conduitsize ?? ""),
    panelLocation: String(row.lum_panellocation ?? ""),
    departments:   String(row.lum_departments ?? ""),
    outsourced:    Boolean(row.lum_outsourced ?? false),
    notes:         String(row.lum_notes ?? ""),
    status:        optionSetToStatus(Number(row.lum_status ?? 100000000)),
  };
}

const STATUS_OPTIONS = {
  Draft:     100000000,
  Submitted: 100000001,
  Approved:  100000002,
  Built:     100000003,
} as const;

function statusToOptionSet(status: SignSpec["status"]): number {
  return STATUS_OPTIONS[status] ?? STATUS_OPTIONS.Draft;
}

function optionSetToStatus(code: number): SignSpec["status"] {
  for (const [name, value] of Object.entries(STATUS_OPTIONS)) {
    if (value === code) return name as SignSpec["status"];
  }
  return "Draft";
}

function dataverseRepo(table: PowerProviderTable<DataverseColumns>): SignSpecRepo {
  return {
    async list() {
      const rows = await table.list();
      return rows.map(fromRow);
    },
    async load(id) {
      const row = await table.retrieve(id);
      return row ? fromRow(row) : null;
    },
    async save(spec) {
      const row = toRow(spec);
      const saved = spec.id
        ? await table.update(spec.id, row)
        : await table.create(row);
      return fromRow(saved);
    },
    async remove(id) {
      await table.delete(id);
    },
  };
}

// Pick the active repo once at module load. The Power Apps host injects
// PowerProvider before our bundle runs, so this is stable per session.
export const activeRepo: SignSpecRepo = (() => {
  const provider = typeof window !== "undefined" ? window.PowerProvider : undefined;
  const table = provider?.tables?.SignSpecifications;
  if (table) {
    // eslint-disable-next-line no-console
    console.info("[Sign Builder Pro] connected to Dataverse table SignSpecifications");
    return dataverseRepo(table);
  }
  // eslint-disable-next-line no-console
  console.info("[Sign Builder Pro] no Power Apps SDK detected — using localStorage dev fallback");
  return localSignSpecRepo;
})();
