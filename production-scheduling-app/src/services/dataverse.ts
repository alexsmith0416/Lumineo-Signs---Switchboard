// Production schedule data source — live reads/writes against the
// crfdf_productionscheduleline Dataverse table through the reader seam
// (src/services/dataverse-reader.ts). Register the Power SDK bridge in
// main.tsx and this source goes live; in local dev it reads empty.

import { createLiveScheduleSource } from "./schedule-source-factory";

export const productionDataSource = createLiveScheduleSource({
  kind: "production",
  table: "crfdf_productionscheduleline",
});

// Preserved alias — legacy imports continue to compile.
export const dataverseService = productionDataSource;
