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
│   └── build-seeds.mjs                 ← regenerates everything below
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

## Scheduling Hub

**Direct seed:** drop `scheduling-hub/seed-install-week.json` into the app's
`src/data/` and hydrate the installation store from it (it already matches the
`regions.WK/NEK → crews[] → entries[]` shape, plus a resolved `jobs[]` per entry).
See `scheduling-app/src/services/dataverse.ts` for the `createMockDataSource(...)` pattern.

**Dataverse:** import `scheduling-hub/lum_crewassignment.import.csv` into
`lum_crewassignment`. Placeholder NEK template cells are prefixed `[TEMPLATE]` so you
can filter or grey them.

## Other apps

Sign Builder Pro, Sales Hub, Time & Photo Capture, and the Switchboard splash
prototype don't consume this job export directly — they read `lum_signspec`,
`lum_opportunity`, `lum_timeentry`/`lum_photo`, and `lum_kpisnapshot` respectively.
Their table + column targets are in `DATAVERSE-TABLE-MAPPING.md §1` and `§4` so you
can build matching seeds when those apps come online.
