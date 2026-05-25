# 13 — Airtable Bridge (Temporary Data Source)

## Why this doc exists

Until BC API admin access is granted, Lumineo's existing manually-maintained Airtable base **"LNI Production Schedule"** serves as the operational data source for the apps. The apps still read and write only to Dataverse — a Power Automate flow mirrors Airtable → Dataverse on a schedule. When BC API access lands, the mirror flow gets replaced by the BC sync flow described in [docs/04-dataverse-schema.md](04-dataverse-schema.md), with **zero changes to any app**.

This doc is the field-by-field mapping and the queue strategy for writes during the interim.

## Architecture

```
┌─────────────────────────┐
│   Airtable              │
│   LNI Production        │  ← Lumineo admin team
│   Schedule              │    keys in updates from BC
└───────────┬─────────────┘
            │ pull, every 15 min
            ▼
┌─────────────────────────┐
│   Power Automate flow   │
│   AirtableMirror_Sync   │
└───────────┬─────────────┘
            │ upsert
            ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   Dataverse             │ ◄────── │   All 6 apps            │
│   lum_Job, lum_Task,    │  read/  │   (Switchboard +        │
│   lum_CrewAssignment,   │  write  │    5 sub-apps)          │
│   lum_PendingBCWrites   │         │                         │
└───────────┬─────────────┘         └─────────────────────────┘
            │ writes that need BC
            ▼
┌─────────────────────────┐
│   lum_PendingBCWrites   │  ← queued; drained later by BC sync flow
│   (queue table)         │
└─────────────────────────┘
```

When BC API arrives:
1. Build the `bc_*` virtual tables (Linear ALE-135) + slim cache (ALE-137)
2. Build `BCSync` flow that owns the same Dataverse tables the mirror was writing to
3. Pause `AirtableMirror_Sync` (don't delete — keep as fallback for one sprint)
4. Drain `lum_PendingBCWrites` to BC; switch all writes from "queue + Dataverse" to "Dataverse + BCWriteBack flow"
5. Apps see no behavior change

## Source

- **Airtable base:** "LNI Production Schedule" (`appjphchC6hRzfkMi`)
- **Primary table:** `LNI Production Schedule` (`tbleMDRECIBmBAOM8`) — active jobs
- **Secondary table:** `Current Month Complete` (`tbli8velennfGG1ov`) — archive; sync read-only, do NOT write back
- **Update cadence:** manual (Lumineo admin team keys updates from BC daily-ish)
- **Mirror cadence during interim:** Power Automate every 15 minutes
- **Matching key:** parsed `Job #` portion of the `Job # / Name` field (e.g., `J123456`)

## One Airtable row → multiple Dataverse rows

Each Airtable row is a **Job** with embedded **Task** data spread across ~9 department columns (hours + due dates per stage). The mirror flow decomposes:

```
Airtable row
    │
    ├──► lum_Job  (1 row)
    │      jobNumber, name, customer, status, value, region, ...
    │
    ├──► lum_Task  (up to 9 rows, one per active department stage)
    │      Production—Routing
    │      Production—Metal
    │      Production—Paint Prep/Paint
    │      Production—Material Cut
    │      Production—Assembly
    │      Production—Vinyl
    │      Production—Plex/Application
    │      Installation—Install
    │      Shipping—Ship
    │
    ├──► lum_CrewAssignment  (0–1 rows on the Install task)
    │      persons, assignedPersons (Aiden / Hunter / etc.)
    │
    └──► lum_Photo  (0–N rows from the Sketch attachment field,
                    on first sync only — subsequent sketch edits in
                    Airtable don't propagate)
```

Tasks are only created when their stage is "active" — i.e., either the hours-field OR a stage-date is populated. Empty stages don't produce Task rows.

## Job-level field mapping

`NEW` indicates a column not yet in `docs/04-dataverse-schema.md` — these get added when we extend the `lum_Job` table in the Phase 1a schema work (Linear ALE-124).

| Airtable field | Type | → `lum_Job` column | Notes |
|---|---|---|---|
| `Job # / Name` | multilineText | `jobNumber` + `name` | Parse: line 1 → `jobNumber` (strip "J" prefix, normalize), line 2+ → `name`. If single line, take the J-prefixed token as `jobNumber`, rest as `name`. |
| `Sales` | multipleSelects | `jobSalesRep` (NEW, text) | Comma-join if multiple. Resolve to `Opportunity.owner` (UserProfile lookup) only after Sales Hub creates an Opportunity for this Job. |
| `Location` | text | `installLocation` (NEW, text) | Free-text address/site. |
| `Region` | singleSelect | `region` (NEW, choice) | Choice set: mirror Airtable options. |
| `MFG Region` | singleSelect | `mfgRegion` (NEW, choice) |  |
| `Install Region` | singleSelect | `installRegion` (NEW, choice) |  |
| `Description` | multilineText | `notes` (append section) | Prefix with `### Description\n`. |
| `Job Notes` | multilineText | `notes` (append section) | Prefix with `### Job Notes\n`. |
| `Admin Notes` | multilineText | `notes` (append section) | Prefix with `### Admin Notes\n`. |
| `Sketch` | attachments | `Photo` rows | One sync only (first time row appears). `relatedTo=Job, relatedId=jobId, caption="Initial Sketch", isShowcase=false`. |
| `Priority` | multipleSelects | `priority` (NEW on Job, choice) | Take highest if multiple. Also propagated to every child Task. |
| `Current Status` | singleSelect | `status` | **Status value mapping (see below).** |
| `Sign Types` | singleSelect | `signType` (NEW, choice) | Drives Sign Builder Pro lookup. |
| `Value` | currency | `value` (NEW, currency) |  |
| `Order Date (Received)` | date | `startDate` |  |
| `Date to Hold` | date | `holdStartedAt` (NEW, date) | Drives `isOnHold` (computed). |
| `Date off Hold` | date | `holdEndedAt` (NEW, date) |  |
| `Mfg Target` (formula) | formula | `dueDate` | If `Mfg Target Modified` is set, prefer that. |
| `Mfg Target Modified` | date | `dueDate` (override) |  |
| `Install Target` (formula) | formula | `installTargetDate` (NEW, date) |  |
| `Scheduled Install` | date | (→ Install Task's `scheduledDate`) | Used on the Install Task, not on Job. |
| `Date Installed` | date | `dateInstalled` (NEW, date) | Also flips status to Installed. |
| `Date to Admin` | date | `dateToAdmin` (NEW, date) | Status → Invoicing. |
| `Date Invoiced` | date | `dateInvoiced` (NEW, date) | Status → Invoiced. |
| `Vendor` | multipleSelects | `vendor` (NEW, text) | Comma-join. |
| `P.O. #` | text | `vendorPO` (NEW, text) |  |
| `Vendor Ship Date` | date | `vendorShipDate` (NEW, date) |  |
| `Vendor Status` | singleSelect | `vendorStatus` (NEW, choice) |  |
| `Date Shipped` | date | `dateShipped` (NEW, date) |  |
| `UL Sign` | checkbox | `ulSign` (NEW, bool) |  |
| `Deposit` | singleSelect | `depositStatus` (NEW, choice) |  |
| `RED DATE` | date | `redDate` (NEW, date) | Lumineo-internal escalation flag. |
| `Storage Location` | multipleSelects | `storageLocation` (NEW, text) |  |
| `EMC Content` | multipleSelects | `emcContent` (NEW, text) |  |
| `Process` | singleSelect | `processStage` (NEW, choice) | Cross-checks against `status`. |
| `Bill Day Job` | singleSelect | `billDayJob` (NEW, choice) |  |
| `Powerlines` | singleSelect | `powerlinesStatus` (NEW, choice) | Install-prep gate. |
| `Locates` | singleSelect | `locatesStatus` (NEW, choice) | Install-prep gate. |
| `Ready for Install` | singleSelect | `readyForInstall` (NEW, choice) |  |
| `Last Modified - Current Status` | lastModifiedTime | `statusLastChangedAt` (NEW, datetime) | System mirror. |

### `Current Status` → `lum_Job.status` mapping

Airtable's `Current Status` choices are operational. Map to the canonical `lum_Job.status` choice set defined in doc 04:

| Airtable `Current Status` | → `lum_Job.status` |
|---|---|
| (any pre-production status) | `Quoted` |
| `On Hold`, `Waiting on Customer`, `Waiting on Permits` | `Quoted` + `isOnHold=true` |
| `Scheduled`, `Released to Production` | `Scheduled` |
| `In Production`, `Routing`, `Paint`, `Assembly`, `Vinyl`, `Plex/Application` | `In Production` |
| `Ready for Install`, `Mfg Complete` | `Scheduled` (install) |
| `Installing`, `Installed` | `Installing` |
| `Complete`, `Done` | `Complete` |
| `Invoiced` | `Invoiced` |

The exact Airtable choice values should be confirmed against the live base when the sync flow is built — the mirror flow stores any unmapped status verbatim in `Job.statusRaw` (NEW, text) so nothing is lost.

## Task-level decomposition

For each Airtable row, create up to 9 `lum_Task` rows. A task is created when **either** its hours field OR its due-date formula is non-empty.

| Task `title` | `department` | Hours source | Start-date source | Due-date source | Complete-date source |
|---|---|---|---|---|---|
| Production — Routing | Production | `Routing Hrs` | `Routing Start Date` | `Routing - Final Due Date` (formula) | `Routing Complete` |
| Production — Metal | Production | `Steel` | — | `Metal - Final Due Date` | — |
| Production — Paint Prep/Paint | Production | `Paint Prep` + `Paint` (summed) | — | `Paint Prep/Paint - Final Due Date` | — |
| Production — Material Cut | Production | (no hours field) | — | `Material Cut - Final Due Date` | — |
| Production — Assembly | Production | `Assembly` (number) | — | `Assembly -  Final Due Date` | `Mfg - Complete` |
| Production — Vinyl | Production | (no hours; presence inferred from Vinyl dates) | `Vinyl Prod. Start Date` | `Vinyl Dept Final Due Date` | `Vinyl - Complete` |
| Production — Plex/Application | Production | (no hours field) | — | `Plex/Application - Final Due Date` | — |
| Installation — Install | Installation | `Install` + `Travel` (summed) | — | `Scheduled Install` | `Date Installed` |
| Shipping — Ship | Shipping | — | — | — | `Date Shipped` (or `Date Shipped 2`) |

Each task inherits from the parent Airtable row:
- `jobId` → the parent `lum_Job`
- `priority` → from `Priority` (highest if multi-select)
- `status` derived:
  - has complete-date → `Done`
  - has start-date but no complete-date → `In Progress`
  - has due-date in future, no start-date → `Not Started`
  - has due-date in past, no start-date, parent Job not on hold → `Blocked`
- `assignedTo`: leave null at mirror time. Filled in by the Weekly Scheduler app.

## CrewAssignment from installer fields

For the `Installation — Install` task only, look at the installer checkboxes:

| Airtable field | → `lum_CrewAssignment` |
|---|---|
| `Aiden` (checkbox) | If true, add Aiden's `UserProfile` to `assignedPersons` |
| `Hunter` (checkbox) | If true, add Hunter's `UserProfile` to `assignedPersons` |
| `Aiden -or- Hunter` | If true and neither above is set, leave `assignedPersons` null but set `persons=1` |
| `Vinyl Installer` (multipleSelects) | Add each named person to `assignedPersons` |

Set `source=Manual` on these (since they're explicit installer picks, not derived from BC purchasing). `persons` defaults to count of `assignedPersons` if not otherwise set. Truck/equipment fields stay null — we don't have that data in Airtable today.

## Out of scope for the bridge

- **`lum_SignSpec`** — Sign Builder Pro creates these natively from its own form. Airtable's `Sign Types` field is a single category, not a full spec.
- **`lum_TimeEntry`** — Time & Photo Capture creates these natively from clock-in/out. Airtable has *aggregate hours per stage*, not individual time entries; the mirror does NOT generate TimeEntry rows.
- **`lum_Photo`** — captured via apps. Sketches from the Airtable attachment field are imported once (on first sync of each row); subsequent edits to the Airtable Sketch field are NOT re-mirrored.
- **`lum_Opportunity`** — Sales Hub owns the pre-BC pipeline. The Airtable row represents a job that's already past the opportunity stage.
- **`UserProfile`** — sourced from Entra ID via the seed flow (Linear ALE-132), not from Airtable.
- **`Pasted field 1`–`Pasted field 42`** — junk/staging columns in the Airtable base, ignored.
- **`Current Month Complete` table** — read-only sync into a `lum_Job_Archive` view (optional; not Phase 1).

## Per-app coverage during the interim

| App | Coverage | What's usable | What's missing (vs. BC) |
|---|---|---|---|
| **LNI Production Schedule** | High | Full Job + Task data, hours, dates, vendor info | Real BC SalesOrder IDs, true BC customer linkage, customer billing address |
| **Lumineo Scheduling Hub** | High | Decomposed Tasks per dept, due dates, hours, install crew | TimeEntry data (Production hours come from Airtable totals, not real clock-in/out) |
| **Sales Hub** | Medium | Job lookup by # or sales rep, value, customer name (text only) | Full BC Customer record (address, contact, history), Opportunity pipeline (app-native) |
| **Sign Builder Pro** | Low | `Sign Types` for picker; sketches as initial reference Photos | Full BC Item BOM, vendor catalog, item pricing |
| **Time & Photo Capture** | Medium | Job + Task list for clock-in pickers (read-only from Tasks) | Real BC Planning Lines, BC Resource → employee mapping (use Entra in interim) |

This is the realistic state — three of the five apps can run productively against the Airtable mirror; two run partially and need their app-native flows (SignSpec, Opportunity) plus interim mocks for BC-only data (Customer details, Items, Resources).

## Sync flow design — `AirtableMirror_Sync`

**Trigger:** Recurrence, every 15 minutes (configurable; consider 5 min during active testing).

**Steps:**

1. **List records** from Airtable base `appjphchC6hRzfkMi`, table `LNI Production Schedule`
   - Use `last_modified_time >= now() - 20m` filter to skip unchanged rows (5-min buffer beyond cadence)
   - Page through results (Airtable max 100 per page)
2. **For each Airtable row:**
   - Parse `Job # / Name` → `jobNumber`, `name`
   - **Upsert `lum_Job`** keyed on `jobNumber` (set all mapped fields per the Job table above)
   - **For each of 9 stages**, evaluate "is this stage active?" (hours OR date populated):
     - **Upsert `lum_Task`** keyed on `(jobId, title)`
     - Derive status per the rules above
   - If `Aiden` / `Hunter` / `Vinyl Installer` / `Aiden -or- Hunter` is populated:
     - **Upsert `lum_CrewAssignment`** on the Install task, `source=Manual`
   - If first sync of this row AND `Sketch` attachments exist:
     - For each attachment, **POST to SharePoint** (job folder, `/Sketches/`) and create a `lum_Photo` row pointing to it
3. **Handle deletes:** if an Airtable row that previously existed is no longer in the list (and not in the archive table), mark `lum_Job.statusRaw = "Removed from Airtable"`. Do NOT delete the Dataverse row — operators need history.
4. **Log to `lum_SyncLog`** (new diagnostic table, ≤7 day retention): row count, error count, duration.
5. **On any per-row failure:** log to `lum_SyncLog` with the offending Airtable `recordId` and field name; continue with the rest of the batch.

**Service account:** the flow runs under a dedicated `svc-airtable-mirror@lumineosigns.com` identity with edit access to the Airtable base + the Dataverse environment. Personal accounts must NOT own this flow.

**Backfill on first run:** drop the `last_modified_time` filter for the very first run; subsequent runs use it.

## Writes during the interim: `lum_PendingBCWrites` queue

Apps still write to Dataverse normally. For any write that *will* eventually need to reach BC (e.g., a Sales Hub user winning an Opportunity, a Time & Photo Capture user finalizing punches, a Production user marking a Task complete in a way that should update the BC SalesOrderLine), the app **additionally** inserts a row into `lum_PendingBCWrites`.

Why a queue (rather than just "skip BC writes for now"):
- Preserves intent: when BC comes online, we drain the queue and BC catches up on every operational event from the interim period
- Apps don't need a conditional code path ("if BC available, do X; else, do nothing") — they just write the queue row unconditionally
- The queue gives us an audit trail of every BC-relevant operation that happened during the interim

The queue table spec is added to `docs/04-dataverse-schema.md`.

### App-side pattern

Pseudocode (Power Fx for Canvas, TypeScript for Code Apps):

```
// when Sales Hub user marks an Opportunity Won
Patch('lum_Opportunity', {id: opp.id, stage: "Won", convertedJobId: newJobId});
Patch('lum_PendingBCWrites', Defaults('lum_PendingBCWrites'), {
  entityType: "Opportunity",
  entityId: opp.id,
  operation: "CreateSalesQuote",
  payload: JSON({/* the BC salesQuote-shaped object */}),
  status: "Pending"
});
```

The same shape works for `MarkOrderShipped`, `TriggerInvoicing`, `CreatePurchaseOrder` — the `operation` field determines which BC endpoint the drain flow calls when it runs.

### Drain flow — `PendingBCWrites_Drain` (BUILT LATER, when BC API lands)

- Trigger: every 5 minutes
- Query `lum_PendingBCWrites` where `status = "Pending" AND attempts < 5`
- For each: POST to BC per `operation` → on success, set `status=Posted`, store `bcRef`; on failure, increment `attempts`, store `lastError`
- Records with `attempts = 5` go to `status=Failed` and surface in an Ops review screen

This flow is **not built during the interim** — it's the cutover artifact. But the queue rows accumulate immediately, so day 1 of BC API access has work to drain.

## What this doc does NOT cover

- The Airtable schema's many "Pasted field N" columns — ignored entirely
- Read-only ingest of the `Current Month Complete` archive table — recommend adding as a separate `lum_Job_Archive` view in Phase 2
- The specific Power Automate connector wiring (Airtable connector setup, auth, error handling boilerplate) — that lives in the flow build issue (new Linear issue suggested below)

## Linear issues to add for this work

Suggested new issues in **Platform Foundation**:

1. **Extend `lum_Job` and `lum_Task` schemas** with the `NEW` columns identified in this doc (~22 new columns on Job, 0–1 on Task). Update the migration plan in ALE-124.
2. **Build `AirtableMirror_Sync` Power Automate flow** — replaces the BC sync flow temporarily; structured for easy swap. Estimate: 5 pts.
3. **Create `lum_PendingBCWrites` table** + indexes (`status`, `entityType`). Estimate: 1 pt.
4. **Create `lum_SyncLog` diagnostic table** for mirror flow + future BC flow. Estimate: 1 pt.
5. **Build `PendingBCWrites_Drain` flow** — held back until BC API access lands. Estimate: 5 pts. (Stub issue, blocked by `ALE-120`.)

These can be wired as blockers/unblockers of the existing Switchboard and sub-app anchor issues — items 1+2 effectively replace ALE-135 (BC virtual tables) as the upstream gate for sub-app data work *during the interim only*.
