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
import type { DataverseColumns, PowerProviderTable } from "./powerProvider";
import "./powerProvider"; // side-effect: registers window.PowerProvider type

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
    lum_name:                 spec.name,
    lum_signprojectid:        spec.projectId ?? null,
    lum_projectname:          spec.projectName,
    lum_quantity:             spec.quantity,
    lum_signtypecode:         spec.signTypeCode,
    lum_faces:                spec.faces,
    lum_illumination:         spec.illumination,
    lum_ledcolorcode:         spec.ledColor,
    lum_facetypecode:         spec.faceType,
    lum_facetypecustom:       spec.faceTypeCustom,
    lum_finishcode:           spec.finish,
    lum_finishcustom:         spec.finishCustom,
    lum_paintcolor:           spec.paintColor,
    lum_vinylcode:            spec.vinyl,
    lum_vinylcolor:           spec.vinylColor,
    lum_vinylhex:             spec.vinylHex,
    lum_mountingcode:         spec.mounting,
    lum_mountingcustom:       spec.mountingCustom,
    lum_heightin:             spec.heightIn ? Number(spec.heightIn) : null,
    lum_widthin:              spec.widthIn  ? Number(spec.widthIn)  : null,
    lum_depthin:              spec.depthIn  ? Number(spec.depthIn)  : null,
    lum_backertype:           spec.backerType,
    lum_backertypecustom:     spec.backerTypeCustom,
    lum_backercolor:          spec.backerColor,
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
    id:               String(row.signspecificationid ?? row.id ?? ""),
    productCode:      String(row.lum_productcode ?? ""),
    name:             String(row.lum_name ?? ""),
    projectId:        row.lum_signprojectid ? String(row.lum_signprojectid) : undefined,
    customerName:     String(row.lum_customername ?? ""),
    projectName:      String(row.lum_projectname ?? ""),
    quantity:         Number(row.lum_quantity ?? 1),
    signTypeCode:     (String(row.lum_signtypecode ?? "")) as SignSpec["signTypeCode"],
    faces:            (String(row.lum_faces ?? "")) as SignSpec["faces"],
    illumination:     (String(row.lum_illumination ?? "")) as SignSpec["illumination"],
    ledColor:         (String(row.lum_ledcolorcode ?? "WH")) as SignSpec["ledColor"],
    faceType:         (String(row.lum_facetypecode ?? "")) as SignSpec["faceType"],
    faceTypeCustom:   String(row.lum_facetypecustom ?? ""),
    finish:           (String(row.lum_finishcode ?? "")) as SignSpec["finish"],
    finishCustom:     String(row.lum_finishcustom ?? ""),
    paintColor:       String(row.lum_paintcolor ?? ""),
    vinyl:            (String(row.lum_vinylcode ?? "")) as SignSpec["vinyl"],
    vinylColor:       String(row.lum_vinylcolor ?? ""),
    vinylHex:         String(row.lum_vinylhex ?? ""),
    digitalRef:       "",
    mounting:         (String(row.lum_mountingcode ?? "")) as SignSpec["mounting"],
    mountingCustom:   String(row.lum_mountingcustom ?? ""),
    heightIn:         row.lum_heightin == null ? "" : String(row.lum_heightin),
    widthIn:          row.lum_widthin  == null ? "" : String(row.lum_widthin),
    depthIn:          row.lum_depthin  == null ? "" : String(row.lum_depthin),
    backerType:       (String(row.lum_backertype ?? "")) as SignSpec["backerType"],
    backerTypeCustom: String(row.lum_backertypecustom ?? ""),
    backerColor:      String(row.lum_backercolor ?? ""),
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

// Pick the active repo on first use, not at module-init. Resolving at init
// is what `dataverseService` would prefer, but `dataverseService` re-exports
// `activeRepo` AND defines `localSignSpecRepo` — running the picker eagerly
// causes a TDZ ReferenceError in the production bundle (circular import).
// The lazy-getter pattern means both modules finish loading before the
// fallback ever runs.
let _cached: SignSpecRepo | null = null;
function getActiveRepo(): SignSpecRepo {
  if (_cached) return _cached;
  const provider = typeof window !== "undefined" ? window.PowerProvider : undefined;
  const table = provider?.tables?.SignSpecifications;
  if (table) {
    // eslint-disable-next-line no-console
    console.info("[Sign Builder Pro] connected to Dataverse table SignSpecifications");
    _cached = dataverseRepo(table);
  } else {
    // eslint-disable-next-line no-console
    console.info("[Sign Builder Pro] no Power Apps SDK detected — using localStorage dev fallback");
    _cached = localSignSpecRepo;
  }
  return _cached;
}

export const activeRepo: SignSpecRepo = {
  list:   ()       => getActiveRepo().list(),
  save:   (s)      => getActiveRepo().save(s),
  load:   (id)     => getActiveRepo().load(id),
  remove: (id)     => getActiveRepo().remove(id),
};
