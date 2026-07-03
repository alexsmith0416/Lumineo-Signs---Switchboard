# Lumineo Scheduling Hub — Production Build

The production Power Code App (registered as **Weekly Calendar** in Switchboard). Engine + UI + Zustand stores are ported verbatim from `../scheduling-app/`; the service layer (`src/services/*`) reads the Sign365 → Power Automate → Dataverse mirror per [`../docs/18-sign365-api-reference.md`](../docs/18-sign365-api-reference.md).

## Status

Service layer is **wired to Dataverse** through the reader seam (`src/services/dataverse-reader.ts`). One registration call in `main.tsx` connects everything; until then the app boots in local-dev mode with empty calendars.

| Service | State | Reads |
|---|---|---|
| `services/dataverse.ts` (productionDataSource) | ✅ wired | `crfdf_productionscheduleline` + employees/departments/work-hours/overtime |
| `services/installation-data.ts` (WK + NEK) | ✅ wired | `crfdf_installationscheduleline` filtered by `crfdf_region` |
| `services/shipping-data.ts` | ✅ wired | `crfdf_shippingscheduleline` |
| `services/bc.ts` (job search) | ✅ wired | `crfdf_bcjob` + `crfdf_bcplanningline` + `crfdf_bccostandsales` + `crfdf_bctripresource` |
| `services/zip-geo.ts` | ✅ wired | `crfdf_bczipgeo` |
| `services/weather.ts` + `WeatherChip` | ✅ wired | `crfdf_weathercache` (ship-to ZIP keyed) |
| `services/install-candidates.ts` | ⏳ stub | M11 |

## Going live — the one-time Power Platform steps

1. **Add each Dataverse table as a data source** (generates typed services under `src/Services/`):

   ```bash
   pac code add-data-source -a dataverse -t crfdf_bcjob
   pac code add-data-source -a dataverse -t crfdf_bcplanningline
   pac code add-data-source -a dataverse -t crfdf_bccostandsales
   pac code add-data-source -a dataverse -t crfdf_bctripresource
   pac code add-data-source -a dataverse -t crfdf_bczipgeo
   pac code add-data-source -a dataverse -t crfdf_weathercache
   pac code add-data-source -a dataverse -t crfdf_productionscheduleline
   pac code add-data-source -a dataverse -t crfdf_installationscheduleline
   pac code add-data-source -a dataverse -t crfdf_shippingscheduleline
   pac code add-data-source -a dataverse -t crfdf_employee1
   pac code add-data-source -a dataverse -t crfdf_department1
   pac code add-data-source -a dataverse -t crfdf_employeeworkhours
   pac code add-data-source -a dataverse -t crfdf_overtimeoverride
   ```

2. **Register the bridge** in `src/main.tsx` — the exact snippet is in the header comment of [`src/services/dataverse-reader.ts`](src/services/dataverse-reader.ts). ~20 lines, maps the generated services onto the reader interface.

3. Done. Every service reads through the seam; no other file changes.

## What each Power Automate flow must write

The services read defensively (multiple candidate column names), but these are the canonical columns each sync flow should populate:

### `crfdf_bcjob` ← Sign365 `/jobs` (hot · 5–10 min)
`crfdf_jobno` · `crfdf_shiptoname` (**display name of the job**) · `crfdf_billtoname` · `crfdf_shiptoaddress` · `crfdf_shiptocity` · `crfdf_shiptostate` · `crfdf_shiptozip` (**drives the weather chip**) · `crfdf_promiseddate`

### `crfdf_bcplanningline` ← Sign365 `/projectPlanningLines` (hot)
`crfdf_jobno` · `crfdf_lineno` · `crfdf_type` (only `Resource` rows show in the picker) · `crfdf_description` · `crfdf_quantity` (estimated labor hours)

### `crfdf_bccostandsales` ← Sign365 `/jobCostAndSales` (cool · 30 min)
`crfdf_jobno` · `crfdf_contractvalue` · `crfdf_invoicedamount` · optionally `crfdf_remainingtoinvoice` (computed in the flow; otherwise the app derives `max(0, contract − invoiced)`)

### `crfdf_bctripresource` ← Sign365 `/TripsResources` (warm · 15–30 min)
One row per (trip, resource): `crfdf_jobno` · `crfdf_tripno` · `crfdf_resourceno` · `crfdf_resourcetype` (`Person` | `Machine`) · `crfdf_tripdate`
The app groups by trip → **estimated trips per job**, and counts Person vs Machine rows → **men + trucks per trip** (fallback: fleet-code regex `F##`/`D##`/Chevy/crane/bucket = truck).

### `crfdf_weathercache` ← `Lumineo Weather` flow (every 6 h)
For every distinct ship-to ZIP on the next 14 days of schedule lines, one row per (zip, forecast day): `crfdf_zip` · `crfdf_forecastdate` · `crfdf_condition` (clear/clouds/rain/drizzle/thunderstorm/snow/mist/fog/wind) · `crfdf_label` · `crfdf_temphigh` · `crfdf_templow` · `crfdf_precippct` · `crfdf_windmph` · `crfdf_alert` · `crfdf_fetchedat`
Rows older than 48 h are ignored by the app. The OpenWeatherMap key lives only in the flow.

### `crfdf_bczipgeo` (one-time import)
`crfdf_zip` · `crfdf_city` · `crfdf_state` — ~42k US ZIPs per docs/09.

## How the pieces surface in the UI

- **Job search** (Add Job panel) — accepts a job number (`J103101` / `103101`) **or a ship-to customer name**. Results show job no, ship-to display name, remaining $ to invoice, estimated trip count, and ship-to city/state.
- **Selected job header** — remaining to invoice, ships-to line, and the per-trip crew estimate (`#1 2M·1T · #2 3M·2T`).
- **Created schedule lines** carry `installZip` (= ship-to ZIP → weather chip), `invoiceAmount` (= remaining to invoice → $ chip + weekly/monthly roll-ups), and `crewPersons`/`crewTrucks` seeded from the job's first estimated trip.
- **WeatherChip** — reads the cache keyed by the line's ship-to ZIP + card date; re-renders when the async cache read lands.

## Run it locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5174`). Without the Power SDK bridge the shell renders with empty calendars and a single console warning.

Other scripts:

- `npm run typecheck` — TypeScript check, no emit
- `npm run build` — production build
- `npm run test` — vitest (47 engine tests)

## Source of truth

- Sign365 API + sync plan: [`../docs/18-sign365-api-reference.md`](../docs/18-sign365-api-reference.md)
- Build spec: [`../docs/15-scheduling-app-spec.md`](../docs/15-scheduling-app-spec.md)
- Starter prompt + milestone notes: [`../docs/16-scheduling-app-starter-prompt.md`](../docs/16-scheduling-app-starter-prompt.md)
- Prototype (stakeholder-demo reference): [`../scheduling-app/`](../scheduling-app/)

## Repo layout

```
src/
  engine/         pure TypeScript scheduling logic (ported verbatim, no edits)
  services/       I/O boundary — Dataverse reader seam + live services
  store/          Zustand stores (live + scenario, ported verbatim)
  hooks/          React glue
  components/     UI (ported verbatim)
    scenario/     sandbox-specific components
  styles/         lumineo.css design tokens + component styles
  data/           only custom-card-presets.ts (the one preset file the spec keeps)
```
