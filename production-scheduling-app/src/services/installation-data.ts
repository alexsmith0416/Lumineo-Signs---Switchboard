// Installation schedule data sources — live reads/writes against
// crfdf_installationscheduleline, region-filtered per source. Crew fields
// (crewPersons / crewTrucks) live directly on the schedule line; the
// per-trip estimates come from bcService.getJob(...).trips
// (crfdf_bctripresource mirror).

import { createLiveScheduleSource } from "./schedule-source-factory";

export const wkInstallDataSource = createLiveScheduleSource({
  kind: "installation",
  table: "crfdf_installationscheduleline",
  region: "WK",
});

export const nekInstallDataSource = createLiveScheduleSource({
  kind: "installation",
  table: "crfdf_installationscheduleline",
  region: "NEK",
});

// Default — most existing imports point here.
export const installationDataSource = wkInstallDataSource;
