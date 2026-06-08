// build-seeds.mjs — reproducible transform of the 6/8/2026 side-load into
// app-native JSON seeds + Dataverse Import-from-CSV files.
//
// Inputs  (seed-data/_source/):
//   production-jobs.json        728 cleaned Airtable job records
//   install-schedule-week.json  WK + NEK install/service week of 6/8–6/13
//
// Outputs:
//   lni-production-schedule/seed-production-jobs.json      LniRecord[] (app shape)
//   lni-production-schedule/lni_productionschedule.import.csv   Dataverse import (lni_* headers)
//   scheduling-hub/seed-install-week.json                 normalized + job-joined install week
//   scheduling-hub/lum_crewassignment.import.csv          Dataverse import (lum_* headers)
//
// Run:  node seed-data/scripts/build-seeds.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '_source');
const LNI = join(__dirname, '..', 'lni-production-schedule');
const SCH = join(__dirname, '..', 'scheduling-hub');

const jobs = JSON.parse(readFileSync(join(SRC, 'production-jobs.json'), 'utf8')).jobs;
const week = JSON.parse(readFileSync(join(SRC, 'install-schedule-week.json'), 'utf8'));

// ---- helpers ----------------------------------------------------------------
const s = (v) => (v == null ? '' : String(v));
// Airtable department cells were normalized X->"done", "/"->"in_progress".
// The LNI app's metal/assembly/plex/vinyl selects use the raw '/' and 'X' glyphs.
const dept = (v) => (v === 'done' ? 'X' : v === 'in_progress' ? '/' : s(v));
// CSV cell: quote when needed, collapse embedded newlines so one record = one row.
const csv = (v) => {
  if (v == null) return '';
  let t = String(v).replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const yesno = (b) => (b === true ? 'Yes' : b === false ? 'No' : '');

// ---- 1. LNI Production Schedule: app-native LniRecord[] ---------------------
const lniRecords = jobs.map((j) => {
  const d = j.departments || {};
  return {
    id: j.jobNumber,
    job: j.jobName ? `${j.jobNumber} / ${j.jobName}` : j.jobNumber,
    status: s(j.currentStatus),
    process: s(j.process),
    priority: s(j.priority),
    region: s(j.region) || 'WK',
    sales: s(j.sales),
    signType: '',
    location: s(j.location),
    orderDate: s(j.orderDate),
    expeditor: '',
    scheduledInstall: s(j.scheduledInstall),
    mfgTargetMod: s(j.mfgTargetModified || j.mfgTarget),
    redDate: '',
    vendorShipDate: '',
    value: typeof j.value === 'number' ? j.value : null,
    dip: null,          // calc — recomputed by computeCalcFields()
    totalMfg: null,     // calc
    totalInstall: null, // calc
    readyInstall: s(j.readyForInstall) || '?',
    powerlines: '?',
    locates: '?',
    mfgRegion: s(j.mfgRegion),
    installRegion: s(j.installRegion),
    installArea: '',
    vendor: s(j.vendor),
    po: s(j.poNumber),
    vendorStatus: s(j.vendorStatus),
    graphics: s(d.graphics),
    routingType: s(d.routingType),
    metal: dept(d.metal),
    assembly: dept(d.assembly),
    plex: dept(d.plexApplication),
    paintPrep: '',
    materialCut: '',
    paintPrepHrs: null,
    paintHrs: null,
    steelHrs: null,
    installHrs: null,
    travelHrs: null,
    routingHrs: null,
    ulSign: j.ulSign === true,
    qt: false,
    deposit: '',
    storageLocation: '',
    notes: s(j.jobNotes),
    adminNotes: '',
    mfgNotes: '',
    description: s(j.description),
    mfgFinalDate: '',
    dateToHold: '',
    dateOffHold: '',
    dateInstalled: s(j.dateInstalled),
    dateToAdmin: s(j.dateToAdmin),
    vendorShipDate2: '',
    outsourcedArrival: '',
    paintPrepDueMod: '',
    cutVinylColor: '',
    vinylProd: dept(d.vinyl),
  };
});
writeFileSync(join(LNI, 'seed-production-jobs.json'), JSON.stringify(lniRecords, null, 2));

// ---- 2. LNI Production Schedule: Dataverse Import-from-CSV (lni_* columns) --
// Only columns that exist on the deployed lni_productionschedule table
// (see lni-production-schedule/src/data/fieldDefs.ts dvColumn values).
const lniCsvCols = [
  ['lni_name', (r) => r.job],
  ['lni_current_status', (r) => r.status],
  ['lni_process', (r) => r.process],
  ['lni_priority', (r) => r.priority],
  ['lni_region', (r) => r.region],
  ['lni_sales', (r) => r.sales],
  ['lni_location', (r) => r.location],
  ['lni_description', (r) => r.description],
  ['lni_job_notes', (r) => r.notes],
  ['lni_ready_for_install', (r) => r.readyInstall === '?' ? '' : r.readyInstall],
  ['lni_order_date', (r) => r.orderDate],
  ['lni_mfg_target_modified', (r) => r.mfgTargetMod],
  ['lni_scheduled_install', (r) => r.scheduledInstall],
  ['lni_date_installed', (r) => r.dateInstalled],
  ['lni_date_to_admin', (r) => r.dateToAdmin],
  ['lni_vendor', (r) => r.vendor],
  ['lni_po_number', (r) => r.po],
  ['lni_vendor_status', (r) => r.vendorStatus],
  ['lni_mfg_region', (r) => r.mfgRegion],
  ['lni_install_region', (r) => r.installRegion],
  ['lni_value', (r) => (r.value == null ? '' : r.value)],
  ['lni_ul_sign', (r) => yesno(r.ulSign)],
  ['lni_graphics', (r) => r.graphics],
  ['lni_routing_type', (r) => r.routingType],
  ['lni_metal', (r) => r.metal],
  ['lni_assembly', (r) => r.assembly],
  ['lni_plex_application', (r) => r.plex],
  ['lni_vinyl_prod', (r) => r.vinylProd],
];
const lniHeader = lniCsvCols.map((c) => c[0]).join(',');
const lniRows = lniRecords.map((r) => lniCsvCols.map((c) => csv(c[1](r))).join(','));
writeFileSync(join(LNI, 'lni_productionschedule.import.csv'), [lniHeader, ...lniRows].join('\n') + '\n');

// ---- 3. Scheduling Hub: normalized + job-joined install week ---------------
const jobByNumber = new Map(jobs.map((j) => [j.jobNumber, j]));
const installWeek = { ...week, regions: {} };
for (const [code, region] of Object.entries(week.regions)) {
  installWeek.regions[code] = {
    label: region.label,
    crews: region.crews.map((c) => ({
      employee: c.employee,
      crew: c.crew,
      homeBase: c.homeBase,
      region: c.region,
      entries: c.entries.map((e) => ({
        ...e,
        jobs: (e.jobNumbers || []).map((n) => {
          const j = jobByNumber.get(n);
          return j
            ? { jobNumber: n, jobName: j.jobName, currentStatus: j.currentStatus, installRegion: j.installRegion, value: j.value }
            : { jobNumber: n, jobName: null, matched: false };
        }),
      })),
    })),
  };
}
writeFileSync(join(SCH, 'seed-install-week.json'), JSON.stringify(installWeek, null, 2));

// ---- 4. Scheduling Hub: Dataverse Import-from-CSV (lum_crewassignment) ------
// One row per crew-member / job-day. Non-job rows (Service, PTO, placeholder)
// are kept so the week is complete; placeholder NEK template cells are flagged.
const caCols = ['lum_crewassignment_name', 'lum_assigneddate', 'lum_crewmember', 'lum_truckid', 'lum_role'];
const caRows = [];
for (const [code, region] of Object.entries(week.regions)) {
  for (const crew of region.crews) {
    for (const e of crew.entries) {
      const jobLabel = (e.jobNumbers && e.jobNumbers.length) ? e.jobNumbers.join(' / ') : (e.status || 'Service');
      const task = e.placeholder ? `[TEMPLATE] ${e.task || ''}` : (e.task || e.status || '');
      const name = [jobLabel, e.customer, task].filter(Boolean).join(' — ');
      caRows.push([
        csv(name.slice(0, 200)),
        csv(e.date),
        csv(crew.employee),
        csv(crew.crew),
        csv(`${code} install`),
      ].join(','));
    }
  }
}
writeFileSync(join(SCH, 'lum_crewassignment.import.csv'), [caCols.join(','), ...caRows].join('\n') + '\n');

// ---- summary ----------------------------------------------------------------
const matched = installWeek.regions
  ? Object.values(installWeek.regions).flatMap((r) => r.crews).flatMap((c) => c.entries).flatMap((e) => e.jobs).filter((j) => j.jobName).length
  : 0;
console.log(`LNI records:        ${lniRecords.length}`);
console.log(`LNI CSV rows:       ${lniRows.length}  (${lniCsvCols.length} columns)`);
console.log(`Crew-assign rows:   ${caRows.length}`);
console.log(`Install jobs joined to production records: ${matched}`);
