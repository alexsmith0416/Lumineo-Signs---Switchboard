# 20 · Connect the Dataverse tables to the Weekly Calendar Code App

**Goal:** wire the React Code App (`production-scheduling-app/`) to the live
Dataverse mirror tables the Power Automate flows now maintain, so the app reads
real Business Central jobs, customers, and planning lines instead of mock data.

You do all of this **in VS Code with Claude Code**, from inside the
`production-scheduling-app/` folder. The app is already built to read through a
single seam (`src/services/dataverse-reader.ts`) — you are not rewriting
services, you are just (1) generating the typed Dataverse services with `pac`,
(2) registering the bridge once in `main.tsx`, and (3) confirming the column
names line up. Nothing about BC credentials or secrets touches the app — the app
only ever talks to Dataverse; Power Automate holds the BC connection.

---

## 0 · Prerequisites (once)

```bash
# from anywhere
pac --version                      # Power Platform CLI installed?
pac auth list                      # are you authenticated to the right env?
```

If not authenticated to the environment that holds the mirror tables:

```bash
pac auth create --environment "https://<yourorg>.crm.dynamics.com"
# or: pac auth select --index <n>   to switch to an existing profile
```

Confirm the app is registered as a Code App (it should already be — this repo
was scaffolded with `pac code init`). From the app folder:

```bash
cd production-scheduling-app
cat power.config.json     # should list your environment + app id
```

> If `power.config.json` doesn't exist yet, run `pac code init` first and point
> it at the target environment. Don't do this if the file is already there.

---

## 1 · Add each Dataverse table as a data source

Run these **from `production-scheduling-app/`**. Each command generates a typed
service class under `src/Services/` (e.g. `crfdf_bcjobService`) and appends the
table to `power.config.json`.

### 1a. The three BC mirror tables (the ones your flows fill)

```bash
pac code add-data-source -a dataverse -t crfdf_bcjob
pac code add-data-source -a dataverse -t crfdf_bccustomer
pac code add-data-source -a dataverse -t crfdf_bcplanningline
```

These three are the **must-haves** — they power Add Job (search a real BC job),
the customer join (name + ship-to address), the labor-line picker, contract
value, and trips.

### 1b. The app's own schedule tables (only if they exist in Dataverse yet)

These hold the calendar cards the app writes — the scheduled/moved job cards for
each surface. Add them once you've created the tables:

```bash
pac code add-data-source -a dataverse -t crfdf_productionscheduleline
pac code add-data-source -a dataverse -t crfdf_installationscheduleline
pac code add-data-source -a dataverse -t crfdf_shippingscheduleline
pac code add-data-source -a dataverse -t crfdf_employee1
pac code add-data-source -a dataverse -t crfdf_department1
pac code add-data-source -a dataverse -t crfdf_employeeworkhours
pac code add-data-source -a dataverse -t crfdf_overtimeoverride
```

> **If a table doesn't exist yet, skip it.** The app degrades gracefully — a
> missing schedule table just means that calendar surface loads empty until you
> create the table. Start with 1a, prove the Add Job flow works end-to-end, then
> come back for 1b.

After running these, confirm the services were generated:

```bash
ls src/Services/
# expect crfdf_bcjobService.ts, crfdf_bccustomerService.ts,
#        crfdf_bcplanninglineService.ts, ... plus an index barrel
```

---

## 2 · Register the bridge in `src/main.tsx` (once)

The app reads every table through `getDataverseReader()`. In local dev that
returns a stub (empty reads) so `npm run dev` still boots. In the deployed app
you register the real bridge that forwards to the pac-generated services.

Open `src/main.tsx` and add the bridge **before** `ReactDOM.createRoot(...)`:

```ts
import { registerDataverseReader } from "./services/dataverse-reader";
import * as Gen from "./Services";        // pac-generated barrel

registerDataverseReader({
  async retrieveMultiple(table, options) {
    const svc = (Gen as any)[`${table}Service`];
    const res = await svc.getAll({
      filter: options?.filter,
      select: options?.select,
      orderBy: options?.orderBy,
      top: options?.top,
    });
    return res.data ?? res;
  },
  async create(table, record) {
    return (await (Gen as any)[`${table}Service`].create(record)).data;
  },
  async update(table, id, changes) {
    return (await (Gen as any)[`${table}Service`].update(id, changes)).data;
  },
  async remove(table, id) {
    await (Gen as any)[`${table}Service`].delete(id);
  },
});
```

> **The one thing to verify:** the bridge builds the service name as
> `` `${table}Service` `` — e.g. `crfdf_bcjob` → `crfdf_bcjobService`. Open
> `src/Services/index.ts` (or `ls src/Services/`) and confirm pac used that exact
> casing. If pac exported something different (e.g. `Crfdf_bcjobService` or a
> `getAll` named `getRecords`), adjust the bridge to match — this is the single
> most common wiring mistake. Ask Claude Code in VS Code: *"open src/Services and
> tell me the exact exported service name and method names for crfdf_bcjob"* and
> reconcile the two.

---

## 3 · Column → app-section mapping (what feeds what)

The app already reads these exact columns (defensively — it falls back through
legacy names). **Your job is to confirm the Dataverse columns below actually
exist with these logical names** on each table. Where a name differs, the
fastest fix is to rename the Dataverse column to match; otherwise tell me and
I'll add the alias to the reader.

### `crfdf_bcjob` — Add Job search + job header

| Dataverse column | Feeds | App section |
|---|---|---|
| `crfdf_jobnumber` | Job No (search key / display) | Add Job search, every card's job number |
| `crfdf_billtocustomerno` | Bill-to customer **code** → joins to customer | Customer name + ship-to lookup |
| `crfdf_description` | Job description (interim customer label) | Card subtitle before the customer join resolves |
| `crfdf_promiseddate` / `crfdf_endingdate` | Promised / due date | Due-date badge, cascade pull-back target |
| `crfdf_shiptoaddress` / `crfdf_shiptocity` / `crfdf_shiptostate` / `crfdf_shiptozip` | Ship-to address | Install location, weather chip, map |

> `crfdf_customername` on the job row is currently the **description**, not the
> real customer — the app ignores it and joins the customer at read time (below).

### `crfdf_bccustomer` — customer join

| Dataverse column | Feeds |
|---|---|
| `crfdf_customerno` | **Join key** — matched against `crfdf_bcjob.crfdf_billtocustomerno` (needs the alternate key you added) |
| `crfdf_name` | Real customer name shown on cards |
| `crfdf_addressline1` / `crfdf_city` / `crfdf_state` / `crfdf_postalcode` | Ship-to fallback + geocoding |

> This is why we added `crfdf_customerno` + address columns to the customer sync
> flow — without `crfdf_customerno` there is no join and cards show the bill-to
> code instead of the name.

### `crfdf_bcplanningline` — labor picker, contract value, trips

| Dataverse column | Feeds | Used for |
|---|---|---|
| `crfdf_jobno` | Job No (matches `crfdf_bcjob.crfdf_jobnumber`) | Every planning-line query |
| `crfdf_jobtaskno` | Job task band → phase | Phase mapping (3000s Production, 4000s Install), trip detection (task 4020) |
| `crfdf_lineno` | Line No (Whole Number) | Composite key, ordering |
| `crfdf_type` | `'Resource'` = scheduling labor | The Add Job labor-line picker (`crfdf_type eq 'Resource'`) |
| `crfdf_linetype` | `'Billable'` = job value | Contract value = sum of Billable `crfdf_totalprice` |
| `crfdf_no` | Resource No → department + crew size | Department mapping, men-per-trip |
| `crfdf_description` | Line description | Picker labels, keyword-fallback department |
| `crfdf_quantity` | Estimated hours / qty | 8-hour-day split, trip men fallback |
| `crfdf_totalprice` | Total price LCY | Contract value, invoice amount |
| `crfdf_planningdate` | Planning date | Suggested schedule date |

### `crfdf_productionscheduleline` / `crfdf_installationscheduleline` / `crfdf_shippingscheduleline` — the calendar cards the app writes

All three share one layout (see `src/services/schedule-line-mapping.ts`). Key
columns: `crfdf_jobno`, `crfdf_customername`, `crfdf_planninglinedescription`,
`crfdf_startdatetime`, `crfdf_enddatetime`, `crfdf_estimatedhours`,
`crfdf_overridehours`, `_crfdf_employee_value` (lookup),
`_crfdf_department_value` (lookup), `crfdf_customerduedate`, `crfdf_islocked`,
`crfdf_jobsequence`, `crfdf_invoiceamount`, `crfdf_crewpersons`,
`crfdf_crewtrucks`, `crfdf_installzip`, `crfdf_region`, `crfdf_iscustom`,
`crfdf_customcolor`, `crfdf_customtextcolor`.

### `crfdf_employee1` / `crfdf_department1` — resource rows

- `crfdf_employee1`: `crfdf_employeename`, department lookup, active flag.
- `crfdf_department1`: `crfdf_floworder` (column order), name.

---

## 4 · Run it and prove the connection

```bash
npm run dev          # boots at http://127.0.0.1:5174
```

Local `npm run dev` runs **without** the Power SDK, so the reader is still the
stub — that's expected (you'll see the one-time console warning). To test
against real Dataverse you validate in the deployed Code App:

```bash
npm run build
pac code push          # deploy to the environment
```

Then open the app from the environment and:

1. Click **Add Job** → search a real job number you know is synced, e.g.
   `J35899`. It should resolve the customer name (not the bare code) and list
   the Resource planning lines.
2. Pick a line → the department should be inferred from the resource code, the
   employee filter should follow the department, and the 8-hour-day split should
   populate.
3. If the customer shows as a code instead of a name → the `crfdf_customerno`
   join key or the customer row is missing. Check §3 customer mapping.
4. If search returns nothing → confirm the service name matches (`§2`) and that
   the filter column is `crfdf_jobnumber` (the app searches that, not
   `crfdf_jobno`).

---

## 5 · Troubleshooting checklist

| Symptom | Cause | Fix |
|---|---|---|
| Reads return `[]`, console warns "No reader registered" | Bridge not registered / running local `npm run dev` | Normal in dev; deploy with `pac code push` to test live |
| `svc.getAll is not a function` | pac generated a different method name | Open `src/Services/<table>Service.ts`, match the real method in the bridge |
| `(Gen as any)[...]Service` is undefined | Service-name casing mismatch | Reconcile bridge `` `${table}Service` `` with the real export in `src/Services/index.ts` |
| Job search finds nothing | Wrong search column | App searches `crfdf_jobnumber`; confirm the column exists and is populated |
| Customer shows as a code | No customer join | Ensure `crfdf_customerno` (+ alt key) exists on `crfdf_bccustomer` and is filled |
| Contract value is $0 | No Billable lines synced | Confirm `crfdf_linetype='Billable'` rows exist with `crfdf_totalprice` |
| No trips on install cards | Task-4020 lines missing | Confirm Install Travel (`crfdf_jobtaskno='4020'`, `crfdf_type='Resource'`) lines synced |

---

## Security note (keep in force)

The Code App **never** holds Business Central credentials. It reads Dataverse
only; the Power Automate flows own the BC connection. Do not add a BC client id
or secret to `.env`, `power.config.json`, the app bundle, or any committed file.
Any BC secret belongs in Azure Key Vault or a Power Platform environment
variable. (The UAT secret that was exposed earlier should have been rotated —
if it hasn't, rotate it now.)
