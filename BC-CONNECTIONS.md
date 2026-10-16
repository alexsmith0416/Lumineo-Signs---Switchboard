# BC-CONNECTIONS — Business Central connection map (single source of truth)

**Load this file at the start of any session that touches Business Central** —
a new extension, a flow, a probe, or a Production cutover. It records every
connection between BC and our tools: environments, auth, Infotech's objects
and their limits, our extensions, the Power Automate flows, the Dataverse
tables, and how-tos.

- **Last updated:** 2026-10-14 (created from START-HERE.md, `bc/`, `flows/`, `scripts/` and app source)
- **Lives at:** `C:\Users\Alex\lumineo-scheduling-port\BC-CONNECTIONS.md` (repo root, in git)
- **Consumers documented so far:** Lumineo Switchboard (`apps/scheduling/`)
- 🔒 **No secrets in this file, ever.** It records *where* a secret lives and how it's moved, never the value.

---

## 0. Maintenance rules (Claude: follow these every session)

Update this file **in the same change** whenever any of these happen:

| Event | Update |
|---|---|
| Extension built / published (UAT or Production) | §2 install matrix, the extension's object table + version history, §15 changelog |
| New AL object | the extension's object table, §6.1 ID registry |
| New extension | new §6.x section (copy the template in §6.0), §6.1 ID registry, §2 matrix |
| Flow created / imported / patched / turned on or off | §8 flow tables, §2 matrix, §15 |
| New Dataverse table/column fed by or feeding BC | §9 |
| BC permission set / app card / User Setup change | §3.3, §2 matrix |
| New Infotech finding (behaviour, limitation, field number) | §5 |
| Production promotion | §2 matrix (Production column), §12 checklist ticks, §15 |
| Open item resolved or discovered | §14 |

Rules:
1. Every change gets a dated line at the top of **§15 Changelog** (newest first). START-HERE and other sessions read the changelog to see what's new.
2. Record state **per environment** — UAT and Production are tracked separately; never assume Production matches UAT.
3. If a fact here contradicts the code, **the code wins** — fix this file.
4. Keep detail here; keep START-HERE.md to a pointer.

---

## 1. Architecture at a glance

```
                     ┌──────────────── Business Central (tenant luminousneon.com) ──────────────┐
                     │  Standard BC (Job, Purchase Header/Line, Resource, …)                       │
                     │  Infotech apps (Project Planning, Shop Floor, Sign365 "Lumineo Signs -      │
                     │                 Projects")                                                  │
                     │  OUR extension: lumineo-planning-ext (58400–58449)                          │
                     │     OData page 58400 · API api/lumineo/planning/v1.0 · page parts on cards │
                     └───────────────▲───────────────────────────────────┬────────────────────────┘
                                     │ BCPush_* (write)                  │ BCSync_* (read)
                     ┌───────────────┴───────────────────────────────────▼────────────────────────┐
                     │  Power Automate (Dataverse env "Alex Smith's Environment")                   │
                     └───────────────▲───────────────────────────────────┬────────────────────────┘
                                     │ outbox rows / sync requests       │ crfdf_* staging tables
                     ┌───────────────┴───────────────────────────────────▼────────────────────────┐
                     │  Dataverse  ◄──── Lumineo Switchboard (Power Apps Code App) — never calls BC│
                     └──────────────────────────────────────────────────────────────────────────────┘
```

- The **app never calls BC directly.** It reads Dataverse staging tables filled by `BCSync_*` flows, and writes outbox rows (`crfdf_bcpushqueue`) / receiving rows / sync requests that `BCPush_*` / `BCSync_*` flows act on.
- **Writes to BC go only through our extension's objects** (page 58400, API pages 58422/58423) or the Infotech `sign365` `jobs` endpoint — never by PATCHing Infotech catalogue pages (see §5.4).
- BC shop-floor actions (punch "Task complete") flow the other way: BC table 58410 → API → flow → Dataverse → app.

---

## 2. Environments & install matrix

### 2.1 Environments

| | UAT (sandbox) | Production |
|---|---|---|
| BC environment name (URL) | `UAT` | `Production` |
| Connector `bcenvironment` value | `UAT` | `PRODUCTION` |
| Tenant | `fe0182fa-d183-46ab-8493-9e8ea9c3d0b8` (`luminousneon.com`) | same |
| Company name | `Luminous Neon` | `Luminous Neon` (confirm) |
| Company id | `4738bfb5-a06d-ec11-bf27-000d3a132a9e` | **unconfirmed** — may differ |
| BC version | 28 (application 28.0.0.0 / runtime 17.0) | confirm before upload |
| Infotech Project Planning | 28.0.84.0 | must be ≥ 28.0.84.0 (confirm) |
| App registration (Entra app card) | "PowerApps Permissions" `34a4de23-4db0-48d9-a941-285c9c2f9b5d` | confirm (same or new registration) |

Dataverse side (all consumers so far): env **"Alex Smith's Environment"** `484cdd3c-4409-e741-bbd5-7c210e00310e`, org `https://org8fa22efd.crm.dynamics.com` — a **Developer** environment (non-admin rollout needs Sandbox/Production Dataverse).

### 2.2 What's installed where

| Item | UAT | Production |
|---|---|---|
| Extension `lumineo-planning-ext` | **v1.0.0.18** (Oct 9, 2026) | ❌ not installed |
| Web service `LumineoProjectPlanning` (page 58400) | ✅ published | ❌ |
| Web services `LumineoPlanningSteps` / `LumineoPlanningStepCard` / `LumineoPlanningAct` (Infotech catalogue — unused) | published | published — **unpublish at cutover** |
| Web services `LumineoJobPOs` / `LumineoJobPOArchive` (dead, 404) | rows exist — delete | — |
| User Setup row for `POWERAPPS PERMISSIONS` | ✅ (Sep 28) | ❌ needed |
| App card permission sets | see §3.3 | ❌ to set |
| Legacy `BCSync_*` nightly flows (BCSyncReview) | — | ✅ read **PRODUCTION** (hardcoded) |
| BCSync_JobReleaseDates | ✅ reads UAT (parameterised) | — |
| BCCheckNow flows (NewOrders, TaskCompletions, JobDescriptions, JobPOs, JobSketches, Scheduler) | ✅ imported Oct 12 · Scheduler **imports Off** — confirm On | — |
| BCPush_PlanningSteps | ✅ On (UAT) | — |
| BCPush_JobCompletion | imported (UAT; on/off not recorded) | — |
| BCPush_PoReceipts / BCPush_PoDeliveries | ✅ On (UAT, Oct 11) | — |

> ⚠️ Mixed state today: the **legacy read flows pull Production BC data** while every **write-back and extension-backed flow points at UAT**. Keep this in mind when comparing numbers.

---

## 3. Connection & authentication

### 3.1 Base URLs

| Purpose | URL pattern |
|---|---|
| API root | `https://api.businesscentral.dynamics.com/v2.0/<tenant>/<env>/api` |
| **Our API** | `…/api/lumineo/planning/v1.0/companies(<companyId>)/<entitySet>` |
| **Our OData page** | `…/<env>/ODataV4/Company('Luminous Neon')/LumineoProjectPlanning` |
| Infotech Sign365 API | `…/api/infotechConsultingGroup/sign365/v1.0/companies(<id>)/…` (JobCompletion flow uses the domain form `v2.0/luminousneon.com/UAT/…`) |
| Microsoft analytics | `…/api/microsoft/analytics/v1.0/…` (`jobs`, `jobPlanningLines`, `salesLines`) |
| Microsoft standard v2.0 | `…/api/v2.0/…` (`customers`, `salesOrders`) |
| BC web client deep links | `https://businesscentral.dynamics.com/<tenant>/Production/?company=Luminous Neon&page=…` (tenant + env pinned — no default-env redirect; `BC_ORIGIN` in `services/job-links.ts`). Page 88 Job Card, page 50 Purchase Order, page 9347 PO archive (`services/job-links.ts`, `services/job-pos.ts`). Open Project only for a real job no. (`isBcJobNo`) |

### 3.2 Auth methods

- **HTTP actions (all newer flows, probe scripts):** OAuth client credentials (`ActiveDirectoryOAuth`). Authority `https://login.microsoftonline.com`, audience `https://api.businesscentral.dynamics.com` (scope `/.default`). Flow parameters `Bc_Tenant`, `Bc_Audience`, `Bc_ClientId`, `Bc_ClientSecret`, `Bc_ApiBase`, `Bc_ODataBase`, `Bc_CompanyId`, `Bc_Environment`.
- **BC connector `shared_dynamicssmbsaas`** (legacy syncs, ReleaseDates, parts of NewOrders): the maker's own connection, connection reference `new_shareddynamicssmbsaas_69260`.
- **The BC service user** for the app registration shows in BC as `POWERAPPS PERMISSIONS`.

**Client secret handling** (never committed):
- Committed clientdata JSON holds placeholders (`<< store in Key Vault … >>`).
- Build scripts inject it only from `$env:BC_CLIENT_SECRET` into the staged copy; the zip lands in `C:\Users\Alex\Downloads\` → **delete it after import**.
- After import: `apps/scheduling/scripts/copy-bc-secret-to-flows.ps1 -Targets <flows>` copies `Bc_ClientSecret` from an existing flow into the targets (prints only the length).
- Scripts/probes read tenant / client id / secret / env from the Postman env file: `C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json`.
- 📋 Planned before Production: a Key Vault–backed Dataverse secret environment variable.

### 3.3 BC permissions

| Principal | Holds | Notes |
|---|---|---|
| App card "PowerApps Permissions" (UAT) | D365 BUS FULL ACCESS, ICG.IPS.ADMIN, ICG.IPS.GENERAL, ICG.PROJECTPLANNING, ICG.PROJPLANNING.ADM, ICG.SGPN365, LOGIN, **SECURITY** | All System scope, Company blank. 🧹 Remove SECURITY (added by mistake) and the redundant ICG.PROJECTPLANNING / ICG.IPS.GENERAL once LUM PLANNING WB is assigned. |
| `asmith@lumineosigns.com` (UAT) | SECURITY (Sep 22), **EXTEN. MGT. - ADMIN** (Company blank — needed for symbols/publish; old name "D365 EXTENSION MGT" no longer exists), D365 BASIC, D365 BUS FULL ACCESS | SECURITY only hands out sets you hold → assigning `LUM PLANNING WB` needs a **SUPER** admin. |
| Our permission set `LUM PLANNING WB` (58400) | page 58400 X; ICG.IPP.ProjectPlanning **RIM**; ProjectPlanningStep R; ProjPlanTripResource R; Job/Resource R; queries 58401/58402 X; Purchase Header/Line (+Archive) R | Intended for the app card; **never assigned yet** (needs SUPER). |
| `LUM JOB PO READ` (permissionset extension of D365 BUS FULL ACCESS) | queries 58401/58402 X | Workaround so the app card can run the PO queries. Remove once LUM PLANNING WB is assigned. |

- **Editing the app card:** State Disabled → edit → Enabled → **Grant Consent**. ⚠️ Every BC flow using this client id fails while it's Disabled.
- **User Setup row** for `POWERAPPS PERMISSIONS` is required — Infotech's `Complete` validation does `User Setup.Get(UserId)` ("The User Setup does not exist").
- BC reports missing permissions **one at a time** — expect to iterate. Filter permission sets on `icg` to find Infotech's (searching "Project Scheduler" finds nothing).

---

## 4. Standard BC objects we touch

| Object | How |
|---|---|
| Table **Job** / page **88 Job Card** | read (analytics `jobs`, our API 58403); Job Card gets our part 58425; Sign365 `jobs('J…')` PATCH for job completion |
| Table **Purchase Header / Purchase Line** (+ Archive) | read by queries 58401/58402; tableextension 58420 adds a FlowField |
| Page **50 Purchase Order** | pageextension 58420 adds Vendor Status + Receiving part |
| Page **9347** | archived PO link target |
| Table **Resource** | Resource No. = employee/crew identity (`Assigned To` / `Completed By` are **Resource No. Code[20], not names**); Resource Name ↔ job Description 2 gives Order Type |
| Analytics `jobPlanningLines`, `salesLines`; v2.0 `customers`, `salesOrders` | read by legacy syncs |

---

## 5. Infotech (ICG) — apps, objects, and how they behave

### 5.1 Infotech apps installed

| App | App id | Version (UAT) | We depend on it? |
|---|---|---|---|
| Infotech Project Planning | `dde7ba4d-60fc-48d6-9f2e-ab535dc7b886` | 28.0.84.0 | ✅ compile dependency |
| Infotech Shop Floor Base | `3e0b7896-73bd-438d-8dc3-35614b69744e` | 28.0.0.0 | ✅ |
| Infotech Shop Floor for Projects | `6ac76918-f969-413a-b159-dc7bef22275e` | 28.0.0.0 | ✅ |
| "Lumineo Signs - Projects" (Infotech custom, app id prefix `c4333fb6`) | — | — | ❌ accessed by RecordRef field number only |
| Sign365 API (`infotechConsultingGroup/sign365/v1.0`) | — | — | REST only |

### 5.2 Project Planning (the BC "planning steps" / department queue)

- **Table 71441976 `ICG.IPP.ProjectPlanningStep`** = the step **catalogue** (35 rows: Sales 9 / Production 15 / Installation-Service 11; two "Survey" rows). 9 have ShowOnScheduler = true: Routing, Fabrication, Painting, Assembly Wiring, Face Production, Vinyl, Final Assembly, Final Inspection, Crating. `Power_Automate_Trigger_Url` empty on all.
- **Table 71441977 `ICG.IPP.ProjectPlanning`** = the **per-job step rows** (≈8,147 in UAT, sparse — a job has only the steps it uses). PK `Project No.` + `Code` (Code = catalogue step GUID). This is the real write target, via our page 58400.
- **Table 71441979 `ICG.IPP.ProjPlanTripResource`** — 495 rows; read only.
- Table 71442000 `ICG.IPS.ProjectSchedulerSetup` — reading the step pages needs **ICG.IPS.GENERAL**.
- 🔴 **In BC, "Started" = listed in that department's queue** (tiles show Started and not Complete) — not "scheduled", not "physically started".

**71441977 behaviour (verified UAT, Sep 28):**
- Each moment is stored twice: `X DateTime` in **UTC** and a `Date`/`Time` pair in the **session's local zone**. The service principal's session is UTC → pairs come out 5–6 h off. Our page writes `Sched_Start`/`Sched_End` and pins the pair to Central.
- Validating `Start DateTime` sets **Started = true**.
- Validating `Assigned To` sets Started = true (even when clearing) and sets start = NOW on a row with no start.
- `Duration` is derived only from the pair's OnValidate — never write it.
- `Start Date` / `Due Date` are **obsoleted** by Infotech.
- BC doesn't enforce start ≤ end; bulk PATCH is order-sensitive.
- **Step GUIDs differ per environment** — always resolve by `Step_Description`.
- An Infotech upgrade can change 71441977's schema — re-validate after any Infotech update.

### 5.3 The four ICG.IPP pages — all exhausted (don't revisit)

| Page | Our web service name | Result |
|---|---|---|
| 71441976 `ICG.IPP.ProjectPlanningSteps` | `LumineoPlanningSteps` | catalogue list (35 rows). ⛔ **Never PATCH** — rewrites the template shared by every job |
| 71441977 `ICG.IPP.ProjPlanningStepCard` | `LumineoPlanningStepCard` | catalogue card |
| 71441978 `ICG.IPP.ProjectPlanningSubform` | Infotech's `Job_Card_ExcelICGIPPProjectPlanningSubform`, `Job_ListICGPPIProjectPlanningSubform`, … | ListPart over 71441976; per-job columns are FlowFields keyed by the parent Job → OData has no parent → 35 zeroed rows |
| 71441979 `ICG.IPP.ProjectPlanningAct` | `LumineoPlanningAct` | not OData-exposable (404) |

⚠️ **Page IDs and table IDs are numbered independently** (page 71441977 ≠ table 71441977). That's why we built page 58400 directly over table 71441977.

### 5.4 Sign365 API (`infotechConsultingGroup/sign365/v1.0`)

- `jobs` and `projectPlanningLines` writable since Infotech's Sep 11 Postman collection. `jobs` key = `no` → `jobs('J…')`.
- Job completion: PATCH `{complete, icgSgpCompletionDate}`. **`status` is deliberately never written** (posting/billing consequences).
- `projectPlanningSteps` / `projectPlanningEntries` are `Updatable=false` (step PATCH → `BadRequest_MethodNotImplemented`).
- `projectPlanningLines` key `no` is non-unique (14,030 rows share `26200`).
- Broken Infotech samples: `jobs(<guid>)` → "Error in query syntax"; `orderedBy` doesn't exist; `$filter=auxiliaryIndex4 eq …` → "The supplied column ID '0' cannot be found in the query".
- On `projectPlanningEntries`, `auxiliaryIndex1/3/5` = step-type GUID (shared across jobs).
- Job field **95294 "Service Order"** — empty in UAT.
- Request for a vendor-sanctioned writable step API: `apps/scheduling/flows/BCPush-infotech-request.md` — **NOT sent**.

### 5.5 Shop Floor (punches)

| Object | Notes |
|---|---|
| Table **ICG Labor Entry** | punch rows: Line No., Resource No., Job No., Job Task No., DateTime In/Out, Daily Punch. Infotech posts and moves punches to history — so we never add fields to it; we subscribe to `OnAfterModifyEvent` (DateTime Out set = punch closed). |
| Page **ICG Clock In Job** (BC caption "Clock In Project") | has integration event `OnSubmitOnBeforeClockInJob` |
| Page **ICG Clock Out Job** | has `OnSubmitOnBeforeClockOutJob` |
| Page **70210 "Clock In Multiple Jobs/Nesting"** / **70211 ClockOutMultipleJobsNesting** | what crews actually use. ⚠️ **No integration events**, and their Open Project Punches part is `Editable = false` → we add our own part + the Labor Entry table event |
| Codeunit **ICG Shop Floor for Jobs** | `GetClockedIn(ResourceNo, var JobNo, var TaskNo)` |

Untested: whether Clock In Multiple closes the open punches (the Submit flush records ticks either way).

### 5.6 "Lumineo Signs - Projects" (Infotech custom, tableextension 60200 `ICG.LMN.Job`)

Job Blob fields, read via RecordRef by number (no dependency):
- **60215** `ICG.LMN.FieldDescription`, **60214** `ICG.LMN.ProdDescription`, **60202** `ICG.LMN.ExtendedDescription`; 60219 Design & Estimating (not wanted).
- Stored in **MSDos** encoding (’ = C2, ” = C4; e.g. J29295) → read UTF-8 first, then MSDos.
- Blobs can't be returned by an API/query directly → our API page 58403 converts to text.
- Field numbers were found by downloading the app's symbols from `/dev/packages` with a device-code sign-in.

**Order Type:** no Job field is captioned "Order Type" in UAT and 95294 is blank. The order types are **Resources** of Infotech's "Service" type — the Resource whose **Name = the job's Description 2** ("Service Order" → SERVICE). Values seen: SERVICE, SIGNCONT, MNTCCONT (test job J38696).

---

## 6. Our BC extensions

### 6.0 Template for a new extension (copy this block)

```
### 6.x <extension name>
- Folder: <path> · Repo: <repo>
- app.json id / publisher / version:
- ID range: (register in §6.1 first)
- Dependencies:
- Purpose / consumer tool:
- API route(s): api/<publisher>/<group>/<version>
- Objects: (table: type | ID | name | purpose | API entity / writable?)
- Permissions:
- Version history: (version | date | env | what changed)
```

### 6.1 Object ID registry (avoid collisions)

BC per-tenant extension range is 50000–99,999. Known taken:

| Range / ID | Owner |
|---|---|
| **58400–58449** | `lumineo-planning-ext` (in use: see §6.2) |
| 50100 | Infotech Role Center KPIs page (collided with our first page — moved to 58400) |
| 60200 (tableext), fields 60202–60219 | Infotech "Lumineo Signs - Projects" |
| 70210, 70211 | Infotech Shop Floor multi clock pages |
| 71441976–71442000 | Infotech Project Planning / Scheduler |
| 95294 (Job field) | Sign365 |
| **Next free block suggestion** | **58450–58499** for the next extension |

API publisher in use: `lumineo` (group `planning`). Give each new extension its own **APIGroup** (e.g. `lumineo/warehouse/v1.0`).

### 6.2 `lumineo-planning-ext`

- **Folder:** `C:\Users\Alex\lumineo-scheduling-port\bc\lumineo-planning-ext` (repo `alexsmith0416/Lumineo-Signs---Switchboard`)
- **app.json:** id `7aa51704-725d-423a-a9b0-ddcdd7fcfdad`, name `lumineo-planning-ext`, publisher `Lumineo Signs`, version **1.0.0.18**, platform 1.0.0.0, application 28.0.0.0, runtime 17.0, idRanges 58400–58449, features `NoImplicitWith`, target Cloud (default).
- **Dependencies:** Infotech Project Planning 28.0.84.0, Shop Floor Base 28.0.0.0, Shop Floor for Projects 28.0.0.0 (§5.1).
- **launch.json:** config "UAT sandbox" — Sandbox, environmentName `UAT`, tenant `fe0182fa-…`, startup page 58400.
- **Built `.app` files** sit in the folder (`Lumineo Signs_lumineo-planning-ext_<ver>.app`, 1.0.0.0–1.0.0.18) but `.gitignore` excludes `*.app`, `.alpackages/`, `.snapshots/`, `rad.json` → **built packages are not in git**; rebuild from source or keep a copy.
- **Consumer:** Lumineo Switchboard.

**Objects**

| Type | ID | Name | Purpose | Exposed as |
|---|---|---|---|---|
| Page (List) | 58400 | Lumineo Project Planning | Writable view over **ICG table 71441977**. Insert/Modify allowed, Delete not. Create by `Project_No` + `Step_Description` (resolved by name from the catalogue). `Sched_Start`/`Sched_End` (UTC in → Central pair, Duration = End − Start, restores Started/Complete). `Assigned_To` validates via Infotech then restores Started/Complete/dates/Duration. Writable: Started, Complete, Completed_Date, Completed_By, Quick_Notes. | **OData web service `LumineoProjectPlanning`** (must be published manually). Key `(Project_No='J…',Code=<guid unquoted>)` |
| Query (API) | 58401 | Lumineo Job POs | Open job POs: Purchase Line (Order, Job No. ≠ '') ⋈ Header — jobNo, documentNo, lineCount, amount, vendor, orderDate, status | `jobPurchaseOrders` (read) |
| Query (API) | 58402 | Lumineo Job PO Archive | Archived job POs (max version) | `jobPurchaseOrderArchives` (read) |
| Page (API) | 58403 | Lumineo Job Descriptions API | Job + Blob descriptions as text + `orderType` (Order Type caption → 95294 → Description 2 = Resource Name) | `jobDescriptions` (read) |
| Table | 58410 | LUM Task Completion | One row per "Task complete" tick: Entry No., Resource No./Name, Job No., Job Task No., Completed At, Source, Completed By. InherentPermissions RIMD | via 58411 |
| Codeunit | 58410 | LUM Task Completion | SingleInstance. Holds the pending tick; subscribes `ICG Clock In Job.OnSubmitOnBeforeClockInJob`, `ICG Clock Out Job.OnSubmitOnBeforeClockOutJob`, `ICG Labor Entry.OnAfterModifyEvent`. Records in the punch's own transaction; de-dupes same resource/job/task within 2 min | — |
| Page (API) | 58411 | Lumineo Task Completions API | Read-only feed of table 58410 (+ jobTaskDescription) | `taskCompletions` — poll with `$filter=entryNo gt N` |
| Table | 58411 | LUM Punch Tick | Holds a tick on an open Labor Entry line until the punch closes | — |
| Page (ListPart) | 58412 | LUM Open Punch Ticks ("Mark tasks complete") | Open punches for the resource with a Task complete checkbox | part on 70210/70211 |
| PageExt | 58410 | LUM Clock In Job | "Currently on" + "Complete current task" on Clock In Project | — |
| PageExt | 58411 | LUM Clock Out Job | "Task complete" on Clock Out | — |
| PageExt | 58412 | LUM Clock In Multi | Adds part 58412 to page 70210; wraps Submit (source "Multi Clock In") | — |
| PageExt | 58413 | LUM Clock Out Multi | Same on 70211 ("Multi Clock Out") | — |
| Table | 58420 | LUM PO Receipt | Mirror of Dataverse `crfdf_poreceipt`: PO No. (PK), Job No., Vendor Status, Status By/At; FlowFields Deliveries, Last Received. RIMD | via 58422 |
| Table | 58421 | LUM PO Delivery | Mirror of `crfdf_podelivery`: Id (GUID = Dataverse row id), PO No., Job No., Date Received, Storage Location, Received By, Notes, Final, Received At (site, v1.0.0.18). RIMD | via 58423 |
| TableExt | 58420 | LUM Purchase Header | FlowField "LUM Vendor Status" (nothing stored on BC's table) | — |
| Page (API) | 58422 | Lumineo PO Receipts API | **Writable** (GET/POST/PATCH/DELETE). Key `poReceipts('PO-1234')` | `poReceipts` |
| Page (API) | 58423 | Lumineo PO Deliveries API | **Writable**; DELETE with `If-Match: *`. Key `poDeliveries(<guid unquoted>)` | `poDeliveries` |
| Page (ListPart) | 58424 | LUM PO Deliveries Part ("Receiving (Switchboard)") | Read-only deliveries on the PO card | — |
| Page (ListPart) | 58425 | LUM Job PO Receiving Part ("PO Receiving (Switchboard)") | Read-only POs + status + Stored At on the Job Card | — |
| PageExt | 58420 | LUM Purchase Order | Vendor Status field + part 58424 on page 50 | — |
| PageExt | 58421 | LUM Job Card | Part 58425 on page 88 | — |
| PermissionSet | 58400 | LUM PLANNING WB | See §3.3 | — |
| PermissionSetExt | 58400 | LUM JOB PO READ | Extends D365 BUS FULL ACCESS (see §3.3) | — |

All API objects: APIPublisher `lumineo`, APIGroup `planning`, APIVersion `v1.0` → no Web Services row needed. Only page 58400 needs a Web Services row.

**Version history**

| Version | Date | Env | Change |
|---|---|---|---|
| 1.0.0.0 | Sep 28 | UAT | Page 58400 over 71441977 + LUM PLANNING WB |
| 1.0.0.1 | Sep 28 | UAT | `Sched_Start`/`Sched_End` UTC → Central pair; raw dates read-only |
| 1.0.0.2 | Sep 28 | UAT | Duration = End − Start |
| 1.0.0.3 | Sep 28 | UAT | Insert by `Step_Description`; LUM PLANNING WB → RIM |
| 1.0.0.4 | Sep 28 | UAT | `Assigned_To` validates + restores Started/Complete |
| 1.0.0.5 | Sep 28 | UAT | `Assigned_To` also restores dates + Duration; all 5 write paths verified |
| 1.0.0.6 | Oct 4 | UAT | PO queries as Normal web services — never exposed (404) |
| 1.0.0.7 | Oct 4 | UAT | LUM JOB PO READ permissionset extension |
| 1.0.0.8 | Oct 4 | UAT | API queries 58401/58402 |
| 1.0.0.9–.11 | Oct 4–5 | UAT | API page 58403 jobDescriptions; encoding fix (UTF-8 then MSDos) |
| 1.0.0.12 | Oct 5 | UAT | Task Completion table/API/codeunit + Clock In/Out page extensions |
| 1.0.0.13 | Oct 6 | UAT | Clock In Project always shows "Currently on" + "Complete current task" |
| 1.0.0.14 | Oct 6 | UAT | Multi clock pages: part 58412 + table 58411 + Labor Entry event; verified (Tanner Rue, 3 jobs) |
| 1.0.0.15 | Oct 7 | UAT | `orderType` (caption / 95294) |
| 1.0.0.16 | Oct 7 | UAT | orderType from Description 2 → Resource Name; 707 jobs / 145 service |
| 1.0.0.17 | Oct 8 | UAT | Warehouse: tables 58420/58421, APIs 58422/58423, parts 58424/58425, tableext + PO card / Job Card extensions |
| 1.0.0.18 | Oct 9 | UAT | `Received At` site on deliveries; Stored At site · spot |

---

## 7. Mappings (Switchboard ⇄ BC planning steps)

### 7.1 Department → BC step (`apps/scheduling/src/services/bc-planning-sync.ts`)

| App key | App stage | BC step |
|---|---|---|
| MC | Material Cut | Substrate Cut/Prep |
| S | Steel MFG | Fabrication |
| R | Routing | Routing |
| MF | Metal Fab | Fabrication |
| P | Paint | Painting |
| V | Vinyl / Graphics | Vinyl |
| A | Assembly | Final Assembly |
| CR | Crating | Crating |
| I | Install | Install |
| SE | Service | Service |
| (main) | any department | Production |
| (main) | Install | Installation/Service |

Never written: Assembly Wiring, Face Production (too broad), Final Inspection, Survey. Complete = all folded departments complete; Started = complete or any active.

### 7.2 Job status → BC lifecycle steps (`services/status-lifecycle.ts`, since Oct 8)

| Status | BC effect |
|---|---|
| New Order this week | New Order This Week Started |
| Upcoming Mfg. | NOTW Complete; Upcoming Manufacturing Started |
| Mfg. Ready for Planning | UM Complete; Manufacturing Ready for Planning Started |
| First production status (MFG - …, Steel MFG, NEK - Production, Manufacturing, Active, Subcontracted, Outsourced - Vendor) | every earlier lifecycle step Complete |
| Install - Ready for Planning | Product Ready for Install Scheduling Started (Install NOT started) |
| Install - waiting on product | Install-Waiting on Product Started |
| Installation | Install Started; Product Ready… Complete |
| MFG - Vinyl Install | Vinyl Install Only Started; Vinyl Complete |
| Install completed | Install Complete; Complete-Need Paperwork Started (status auto-moves) |
| Complete to Admin | CNP Complete; **BC job "complete" flag** (Sign365 `jobs` PATCH) |
| Moving backward | later steps re-opened in BC |
| Holds, Needs Shipped, Ready to send to NEK… | nothing |

- **Completed By** = the mover's BC Resource No. (`crfdf_appuser.crfdf_no`; blank if none — never guessed).
- **Job Purchasing** is the purchaser's step in BC — the app only completes it when every PO is Received (Materials ready, `store/po-receiving-store.ts`).
- Service jobs (Order Type SERVICE / SIGNCONT / MNTCCONT) use the Service stepper (SU Survey, SE Service, SA Complete to Admin, SI Complete Invoiced).

### 7.3 BC resource codes → department (`services/planning-line-mapping.ts`)

2010/2313 Routing · 2011/2014/2099 Metal · 2016 Steel · 2110–2199 Paint · 22xx/2312–2399 Assembly · 24xx Vinyl. Production = 2000–2999; install = everything else except 1110.
Known people: Len Cook 1143, Aiden Haskill 1152, Kevin Barnhart listed twice (1207 + 5038 — app uses 5038). Install crew names unresolved in BC: Danny, Richie, Jarrod L, Bryan.

---

## 8. Power Automate flows (Switchboard)

All in Dataverse env "Alex Smith's Environment". Unmanaged solutions, publisher `LumineoSigns` (prefix `lum`). Source: `apps/scheduling/flows/` (`_gen_*.py` generate clientdata, `_build_*.py` build the zip into `Downloads\`). Docs: the matching `.md` in `flows/`.

### 8.1 BC → Dataverse (reads)

| Flow | Solution | Trigger | BC source | Dataverse target | Env |
|---|---|---|---|---|---|
| BCSync_Jobs | BCSyncReview | daily 00:00 | analytics `jobs` | `crfdf_bcjobs` (+ stamps `crfdf_jobschedule` releaseddate) | **PRODUCTION** (hardcoded) |
| BCSync_JobPlanningLines | BCSyncReview | daily 03:00 | analytics `jobPlanningLines` | `crfdf_bcplanninglines` | PRODUCTION — fixed Oct 7 (upsert, 10 jobs at a time) |
| BCSync_Customers | BCSyncReview | daily 05:00Z | v2.0 `customers` | `crfdf_bccustomers` | PRODUCTION |
| BCSync_SalesLines | BCSyncReview | daily ~01:00–01:30 | analytics `salesLines` + v2.0 `salesOrders` | `crfdf_bcjobs` (name, balance, salesperson, amount, ship-to) | PRODUCTION |
| BCSync_BillingLines | BCSyncReview | daily 02:00 | analytics `jobPlanningLines` (Billable) | `crfdf_bcbillinglines` | PRODUCTION |
| BCSync_JobReleaseDates | BCReleaseDates 1.0.0.1 | daily 02:00 CT | sign365 `jobs.icgSgpOrderReleasedDate` | `crfdf_bcjobs.crfdf_releasedate` | UAT (parameterised) |
| BCSync_NewOrders | BCCheckNow 1.0.0.1 | `crfdf_syncrequest` kind `neworders` (Scheduler: 15 min) | OData `LumineoProjectPlanning?$filter=Started eq true and SystemModifiedAt gt …` (step "New Order This Week") + connector reads | creates `crfdf_jobtrack`, `crfdf_bcjobs`, `crfdf_bcplanninglines` | UAT |
| BCSync_TaskCompletions | BCCheckNow | kind `taskcompletions` (5 min) | API `taskCompletions?$filter=entryNo gt <max>` | `crfdf_taskcompletions` | UAT |
| BCSync_JobDescriptions | BCCheckNow | kind `jobdescriptions` (hourly) | API `jobDescriptions?$filter=status eq 'Open'` | `crfdf_jobdescs` | UAT |
| BCSync_JobPOs | BCCheckNow | kind `jobpos` (nightly 5:15) | API `jobPurchaseOrders` + `jobPurchaseOrderArchives` | `crfdf_jobpos` | UAT |
| BCSync_JobSketches | BCCheckNow | kind `jobsketches` (nightly 4:30) | **SharePoint**, not BC (`/sites/JobFiles` thumbnails) | `crfdf_jobsketchs` | — |
| BCSync_Scheduler | BCCheckNow | every 5 min | none — creates `crfdf_syncrequest` rows on the schedule in `_sync_request.py` | `crfdf_syncrequests` | imports **Off** |

Check BC now pattern: each pull flow triggers on a `crfdf_syncrequest` row for its kind (concurrency 1), writes Running → Done/Failed + Result. Scheduler rows are deleted on success. App side: `store/bc-check-store.ts`, `services/sync-request.ts`.

### 8.2 Dataverse → BC (writes)

| Flow | Solution | Trigger | BC call |
|---|---|---|---|
| BCPush_PlanningSteps | BCPushReview 1.0.0.2 | `crfdf_bcpushqueue` added/modified (status), 10 concurrent; acts on pending `schedule` / `state` rows (newer row → older `superseded`) | GET `LumineoProjectPlanning?$filter=Project_No eq '<job>'` → PATCH `(Project_No='…',Code=<guid>)` with `If-Match: *`, or POST. Fields Sched_Start/End, Assigned_To, Started, Complete, Completed_Date, Completed_By |
| BCPush_JobCompletion | BCPushReview 1.0.0.2 | pending `job` rows | PATCH sign365 `jobs('<job>')` `{complete, icgSgpCompletionDate}` (job no. not URL-escaped) |
| BCPush_PoReceipts | BCPoReceiving 1.0.0.2 | `crfdf_poreceipt` add/modify | GET/PATCH/POST `poReceipts` |
| BCPush_PoDeliveries | BCPoReceiving 1.0.0.2 | `crfdf_podelivery` add/modify/delete | PATCH/POST/DELETE `poDeliveries(<guid>)` |

Workflow ids, generator scripts and solution zips are listed in each flow's `.md` under `apps/scheduling/flows/`.

---

## 9. Dataverse tables in the BC path

| Table (set) | Direction | Purpose |
|---|---|---|
| `crfdf_bcjob` (`crfdf_bcjobs`) | BC → DV | job header, customer, ship-to, release date, salesperson, order amount, SharePoint URL |
| `crfdf_bcplanningline` | BC → DV | planning lines → stepper / department queue |
| `crfdf_bcbillingline` | BC → DV | billable lines |
| `crfdf_bccustomer` | BC → DV | customers |
| `crfdf_jobdesc` | BC → DV | Field / Production / Extended descriptions, `crfdf_ordertype` |
| `crfdf_jobpo` | BC → DV | job POs (key `<job>\|<PO>`) |
| `crfdf_taskcompletion` | BC → DV | shop-floor ticks (pending → done / skipped) |
| `crfdf_jobsketch` | SharePoint → DV | sketch thumbnails |
| `crfdf_syncrequest` | app → flows | Check BC now / Scheduler requests |
| `crfdf_bcpushqueue` | app → BC | outbox: kinds `schedule`, `state`, `job` (`completion` retired); status pending / synced / failed / superseded |
| `crfdf_poreceipt`, `crfdf_podelivery` | app → BC | receiving, mirrored into BC 58420/58421 |
| `crfdf_jobtrack` | BC flow creates rows | NewOrders seeds "New Order this week" |
| `crfdf_appuser.crfdf_no` | app | user's BC Resource No. (Completed By) |

Table/column creation scripts: `apps/scheduling/scripts/create-*-table.ps1`, `add-*-column(s).ps1` (idempotent).

---

## 10. Switchboard code touchpoints (`apps/scheduling/src/`)

| File | Role |
|---|---|
| `services/bc-planning-sync.ts` | pure payload builders, dept → BC step map |
| `services/status-lifecycle.ts` | status → BC lifecycle steps |
| `store/bc-stepper-push.ts` | `pushStepperState` — one `state` row per BC step |
| `services/dataverse-live.ts` | outbox writes (`enqueueBcPush(es)`), staging reads, sync requests, `myResourceNo` |
| `services/bc-full-sync.ts`, `store/bc-full-sync-run.ts` | Settings → Business Central → **Sync to BC** |
| `components/BusinessCentralSection.tsx` | Settings panel: **Match Steppers**, **Sync to BC** |
| `services/sync-request.ts`, `store/bc-check-store.ts` | Jobs → **Check BC now** |
| `store/task-completion-processor.ts`, `services/task-completion.ts` | apply BC punch ticks every 2 min |
| `store/po-receiving-store.ts` | receiving; Materials ready → Job Purchasing push |
| `services/production-steps.ts`, `service-steps.ts`, `store/job-steps.ts` | stepper definitions |
| `services/planning-line-mapping.ts` | resource code → department |
| `services/job-links.ts`, `services/job-pos.ts` | BC deep links (pages 88 / 50 / 9347) |

Tests: `bc-planning-sync.test.ts`, `bc-full-sync.test.ts`, `sync-request.test.ts`, `lifecycle-steps.test.ts`, `job-tracking.test.ts`.

---

## 11. How-tos

### 11.1 Build & publish an extension to UAT
1. VS Code + AL Language extension; open the extension folder.
2. **AL: Download Symbols** against `UAT` (your user needs `EXTEN. MGT. - ADMIN`, Company blank). Use application 28 / runtime 17 (29 gave "No published package").
3. Bump the 4th segment of `app.json` `version`.
4. **AL: Publish** (F5, launch config "UAT sandbox") — or **AL: Package** and upload the `.app` in Extension Management.
5. If it's a non-API page that flows read: BC → Web Services → add the page, same service name in every environment.
6. Verify with a probe script (§11.5), then update §2, §6, §15 here.

Infotech symbols not on the dependency list (e.g. "Lumineo Signs - Projects") can be downloaded from `/dev/packages` with a device-code sign-in.

### 11.2 Start a new extension
1. Reserve an ID block in §6.1 (next: 58450–58499) and a new APIGroup.
2. New folder under `bc/` (or a dedicated BC repo), new app id, same publisher `Lumineo Signs`.
3. Prefer **API pages** (`APIPublisher lumineo`) over OData web services — no Web Services row, versioned route.
4. Our own tables: use `InherentPermissions = RIMD` / `InherentEntitlements` so no permission set needs SUPER to assign.
5. Never modify Infotech records' schema; extend with our own tables + events (pattern: §6.2 task completion).
6. Add a §6.x section from the template.

### 11.3 Import a flow solution
1. Run the table/column scripts the flow needs; publish the BC extension version it needs.
2. `cd apps/scheduling/flows` → `python _gen_<x>.py` → `python _build_<x>_solution.py` (optionally with `$env:BC_CLIENT_SECRET`). Zip → `Downloads\`.
3. Maker portal → **Alex Smith's Environment** (not Default) → Solutions → Import; bind connection references.
4. `scripts/copy-bc-secret-to-flows.ps1 -Targets <flow names>` (import can reset the secret).
5. Turn flows On, run once, verify; delete any zip containing the secret.

### 11.4 Patch a live flow
Scripts fetch the clientdata, back it up to `flows/*-backup-<stamp>.json`, edit, PATCH back (`scripts/patch-*.ps1`). ⚠️ The exported JSON in `flows/` is then stale for that flow. Diagnose any flow: `scripts/diagnose-flow.ps1 -FlowName <name> [-Table <logical>]`.

### 11.5 Probe scripts (`apps/scheduling/scripts/`)
`bc-odata-planning-probe.ps1` (read 58400) · `bc-odata-planning-write-test.ps1` (Sched_* write + restore) · `bc-odata-jobpo-probe.ps1` · `bc-odata-jobdesc-probe.ps1` · `bc-job-fields-probe.ps1` · `bc-job-status.ps1` · `bc-uat-write-proof.ps1` · ⛔ `bc-odata-step-probe.ps1 -Write` hits the catalogue — don't use.

---

## 12. Production cutover checklist (UAT → Production)

- [ ] Confirm Production client id, company id, BC version and Infotech Project Planning version (≥ 28.0.84.0).
- [ ] Rebuild the `.app` against Production's symbols; upload via Extension Management (per-tenant).
- [ ] App card: ICG.IPS.GENERAL + ICG.PROJPLANNING.ADM (or LUM PLANNING WB via a SUPER admin). **Don't copy SECURITY.**
- [ ] User Setup line for the flow's BC user.
- [ ] Publish web service `LumineoProjectPlanning` (same name). Unpublish `LumineoPlanningSteps` / `LumineoPlanningAct` / `LumineoPlanningStepCard`.
- [ ] Flow parameters: `Bc_ApiBase` / `Bc_ODataBase` `/UAT/` → `/Production/`, `Bc_Environment` → PRODUCTION, `Bc_CompanyId`, client id/secret if different. Prefer Dataverse env variables (`lum_bc_environment`, `lum_bc_companyid`, `lum_bc_dataset`).
- [ ] Secret → Key Vault.
- [ ] Never hardcode step GUIDs.
- [ ] Re-run probes against Production; turn flows on one at a time; expect permission iterations.
- [ ] Update §2 Production column + §15.

---

## 13. Gotchas

- **GUID keys go unquoted** (`Code=<guid>`, `poDeliveries(<id>)`); text keys quoted (`jobs('J…')`). Quoting a GUID → "Error in query syntax".
- **Service principal session = UTC** → write `Sched_*`, never the raw date/time fields.
- **BC 0001-01-01** fails Dataverse date columns (min 1753) → store null.
- **Dataverse 5,000-row page cap** — un-paged lists are silently cut off (use nextLink).
- **Import resets `Bc_ClientSecret`** (usually) → re-run `copy-bc-secret-to-flows.ps1`.
- **SolutionConcurrencyFailure 80071151** → a publish was still running; re-import.
- **"Unpublished active row" (component type 29)** → open the flow, Save/Publish, re-import.
- **Disabling the app card** breaks every BC flow until re-enabled + consent granted.
- **UAT tests write to the live Dataverse** → test jobs appear on the real Jobs list.
- **`pac code push` UNABLE_TO_VERIFY_LEAF_SIGNATURE** → `NODE_OPTIONS=--use-system-ca`.
- **SharePoint thumbnail `/content` returns 302** → use the thumbnail `url` instead.
- **Version drift:** doc zip names lag the builders (JobSketches 12 vs 14, JobDescriptions 1 vs 2, BCSyncReview 2/5/6); `BCPush_PoReceiving.md` step 1 names the 1.0.0.17 `.app` for v1.0.0.18.

---

## 14. Open items

- [ ] **BCSync_Scheduler On** + first live **Check BC now** (watch the rows finish).
- [ ] **Match Steppers → Sync to BC**: START-HERE's Oct 7 and Oct 8 notes disagree on whether to run them — decide.
- [ ] Receiving: one real receive/remove test in BC, then `backfill-bc-poreceiving.ps1` (dry run, then `-Apply`).
- [ ] SUPER admin to assign `LUM PLANNING WB`; then remove SECURITY / redundant sets from the app card and `LUM JOB PO READ`.
- [ ] UAT cleanup: J31949 Painting test row; delete `LumineoJobPOs` / `LumineoJobPOArchive` Web Services rows.
- [ ] Send `flows/BCPush-infotech-request.md` to Infotech (never sent).
- [ ] Key Vault for the secret.
- [ ] Resolve install crew names (Danny, Richie, Jarrod L, Bryan) to BC Resource Nos.
- [ ] Reconcile the 9 ShowOnScheduler steps with `production-steps.ts`.
- [ ] Decide whether built `.app` files should be kept in git (currently ignored).
- [ ] Warehouse phase 4: stock POs (needs a BC query/API for non-job POs + expected receipt date).
- [ ] Production cutover (§12).

---

## 15. Changelog (newest first)

- **2026-10-15** — Switchboard BC deep links pinned to `/<tenant>/Production/` (faster open; never lands in UAT). Open Project hidden unless the card has a real job no. (BC rejects a No. filter over 20 chars). Install cards: 43 that lost `crfdf_jobno` restored (`scripts/repair-installcard-jobno.ps1`).
- **2026-10-14** — File created. Baseline: `lumineo-planning-ext` v1.0.0.18 in UAT only; nothing in Production; flows as in §8.
