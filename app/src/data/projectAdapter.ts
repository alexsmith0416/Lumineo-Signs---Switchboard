// Project adapter — same runtime-detection pattern as the SignSpec adapter.
// PowerProvider is injected by the Power Apps Code app host when `pac code
// push` runs the published bundle; in dev we use localStorage.

import type { Project } from "../domain/Project";
import type { ProjectRepo } from "./projectRepo";
import { localProjectRepo } from "./projectRepo";
import type { DataverseColumns, PowerProviderTable } from "./powerProvider";
import "./powerProvider"; // side-effect: registers window.PowerProvider type

function toRow(p: Project): DataverseColumns {
  return {
    lum_name:         p.name,
    lum_customername: p.customerName,
    lum_notes:        p.notes,
    lum_createdat:    p.createdAt,
  };
}

function fromRow(row: DataverseColumns): Project {
  return {
    id:           String(row.signprojectid ?? row.id ?? ""),
    name:         String(row.lum_name ?? ""),
    customerName: String(row.lum_customername ?? ""),
    notes:        String(row.lum_notes ?? ""),
    createdAt:    String(row.lum_createdat ?? new Date().toISOString()),
  };
}

function dataverseProjectRepo(table: PowerProviderTable<DataverseColumns>): ProjectRepo {
  return {
    async list() {
      const rows = await table.list();
      return rows.map(fromRow);
    },
    async load(id) {
      const row = await table.retrieve(id);
      return row ? fromRow(row) : null;
    },
    async save(p) {
      const row = toRow(p);
      const saved = p.id ? await table.update(p.id, row) : await table.create(row);
      return fromRow(saved);
    },
    async remove(id) {
      await table.delete(id);
    },
  };
}

export const activeProjectRepo: ProjectRepo = (() => {
  const provider = typeof window !== "undefined" ? window.PowerProvider : undefined;
  const table = provider?.tables?.SignProjects;
  if (table) {
    // eslint-disable-next-line no-console
    console.info("[Sign Builder Pro] connected to Dataverse table SignProjects");
    return dataverseProjectRepo(table);
  }
  return localProjectRepo;
})();
