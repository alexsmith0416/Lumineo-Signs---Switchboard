# seed-data — importable project data for the Switchboard sub-apps

Packaged from the 6/8/2026 side-load (728 jobs + the WK/NEK install week) into:
1. **app-native JSON seeds** you drop straight into a prototype, and
2. **Dataverse Import-from-CSV files** with the correct logical-name headers.

The full field-by-field crosswalk and the app→table matrix live in
**[`DATAVERSE-TABLE-MAPPING.md`](./DATAVERSE-TABLE-MAPPING.md)** — read that first.

```
seed-data/
├── DATAVERSE-TABLE-MAPPING.md          ← master reference (start here)
├── README.md                           ← this file
├── _source/                            ← raw inputs, committed for reproducibility
│   ├── production-jobs.json            728 cleaned jobs
│   ├── production-jobs.airtable-export.csv
│   ├── install-schedule-week.json
│   └── README-original-sideload.md
├── scripts/
│   ├── build-seeds.mjs                 ← regenerates the LNI + crew-assignment artifacts
│   └── build-install-seed.mjs          ← regenerates the Scheduling Hub install module
├── lni-production-schedule/
│   ├── seed-production-jobs.json       728 × LniRecord  (app-native)
│   └── lni_productionschedule.import.csv   728 rows, lni_* headers (Dataverse)
└── scheduling-hub/
    ├── seed-install-week.json          install week, job-joined (app-native)
    └── lum_crewassignment.import.csv   97 rows, lum_* headers (Dataverse)
```

Regenerate any time the source changes:
```bash
node seed-data/scripts/build-seeds.mjs
```

---

## LNI Production Schedule

**Already wired.** `seed-production-jobs.json` was copied to
`lni-production-schedule/src/data/` and the local-dev mock client
(`src/mocks/powerAppsClient.ts`) now loads all 728 records instead of the old
5 samples. Just run the app:
```bash
cd lni-production-schedule && npm run dev
```
This only affects local dev — the deployed build still reads `lni_productionschedule` from Dataverse.

**Load the real table (Dataverse):** Power Apps → `lni_productionschedule` →
**Edit → Import from CSV** → upload `lni-production-schedule/lni_productionschedule.import.csv`.
Columns are pre-mapped by logical name. Notes:
- Choice columns (`lni_current_status`, `lni_process`, `lni_sales`, …) must already
  contain the option values listed in `src/data/fieldDefs.ts`, **or** temporarily set
  those columns to text for the first import.
- `lni_ul_sign` is emitted as `Yes`/`No`.
- The calc columns `lni_dip` / `lni_total_hrs_mfg` / `lni_total_hrs_install` are
  intentionally **not** in the CSV (the app recomputes them).

## Scheduling Hub (`scheduling-app`)

**Already wired.** The installation calendar can't consume flat JSON — its lines are
`ScheduleLine` objects with live `Date` values built relative to the current week. So
`build-install-seed.mjs` generates a typed module instead:
`scheduling-app/src/data/seed-install-week.generated.ts` (19 crews, 97 lines, WK+NEK,
joined to the 728 production records for invoice $ and customer names). The
installation data source now imports from it:
```bash
cd scheduling-app && npm run dev   # Installation calendar shows the 6/8 week
```
- Ray's PTO week renders as locked cards; placeholder NEK template cells are prefixed `[TEMPLATE]`.
- **Revert:** in `src/services/installation-data.ts`, switch the import back to
  `"../data/mock-installation"` (the hand-curated fixtures are untouched).
- **Regenerate** after editing the source week: `node seed-data/scripts/build-install-seed.mjs`.
- Note: the side-load JSON has no zips/crane/lift counts, so those default
  (`installZip:""`, cranes/lifts `0`) — the weather chip needs a zip backfill if you want it.

The flat `scheduling-hub/seed-install-week.json` (job-joined) is still produced for any
view that wants the raw `regions.WK/NEK → crews[] → entries[]` shape.

**Dataverse:** import `scheduling-hub/lum_crewassignment.import.csv` into
`lum_crewassignment`. Placeholder NEK template cells are prefixed `[TEMPLATE]` so you
can filter or grey them.

## Other apps

Sign Builder Pro, Sales Hub, Time & Photo Capture, and the Switchboard splash
prototype don't consume this job export directly — they read `lum_signspec`,
`lum_opportunity`, `lum_timeentry`/`lum_photo`, and `lum_kpisnapshot` respectively.
Their table + column targets are in `DATAVERSE-TABLE-MAPPING.md §1` and `§4` so you
can build matching seeds when those apps come online.
