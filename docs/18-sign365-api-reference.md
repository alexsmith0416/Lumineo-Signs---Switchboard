# Sign365 (Infotech BC API) — Reference & Sync Plan

> The Sign365 API is Infotech Consulting Group's custom Business Central
> extension exposing Lumineo Signs' project / job / planning-line data
> as OData v4 endpoints. Weekly Calendar (and any other Code App that
> needs to read live BC data) consumes it via a Power Automate-managed
> Dataverse mirror — the apps never call BC directly.

---

## 1 · What this is

- **Namespace**: `api/infotechConsultingGroup/sign365/v1.0`
- **Base URL**: `https://api.businesscentral.dynamics.com/v2.0/{tenant}/{environment}/api/infotechConsultingGroup/sign365/v1.0/companies({companyId})/`
- **Company GUID** (Lumineo Signs): `4738bfb5-a06d-ec11-bf27-000d3a132a9e`
- **Protocol**: OData v4 — supports `$filter`, `$select`, `$top`, `$skip`, `$expand`, `$orderby`, `@odata.nextLink` paging
- **Method**: GET only (read). No POST / PATCH / DELETE in the published collection. See §7 for the write-back gap.

Environments configured:

| Environment | Tenant | BC env name | Notes |
|---|---|---|---|
| UAT | `luminousneon.com` | `UAT` | Currently the only one with creds issued |
| Prod | TBD | `Production` | Provision a separate Entra app + client secret before go-live |

---

## 2 · Authentication

**OAuth 2.0 client-credentials flow.**

```
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={clientId}
&client_secret={clientSecret}
&scope=https://api.businesscentral.dynamics.com/.default
```

Response carries `access_token` + `expires_in` (typically 3599s). Cache the token; refresh ~5 minutes before expiry.

Every subsequent Sign365 request sends:

```
Authorization: Bearer {access_token}
```

### Secret handling — do this, not that

| | Do | Don't |
|---|---|---|
| Storage | **Azure Key Vault**, or a **Power Platform environment-variable secret** referencing Key Vault | A `.json` file in the repo |
| Rotation | Track expiry in a calendar; rotate every 6 months and on any suspected exposure | Reuse the same secret across UAT + Prod |
| Logging | Mask the bearer token in all flow run history (`Secure Inputs / Outputs = On`) | Log raw HTTP request/response from the token endpoint |
| Distribution | Send only via Teams chat with confidential sticker, or via 1Password / Bitwarden | Email, Slack, screenshots, Postman exports |

**If a secret has been exposed (uploaded to a chat tool, committed, screenshotted), rotate it in Entra ID immediately** — it doesn't matter how short the exposure was.

---

## 3 · Endpoint reference

All paths are relative to the base URL in §1.

| # | Endpoint | Method | Returns | Primary use in Weekly Calendar |
|---|---|---|---|---|
| 1 | `/jobs` | GET | Master BC Job records — `no`, `description`, `billToCustomerNo`, `customerName`, `status`, dates | **Stage 1 of Add Job** — `?$filter=no eq 'J35899'` |
| 2 | `/projectDetails` | GET | Extended project metadata — long description, customer cross-ref, region, status tags | JobCard tooltip header; Add Job slide-over context |
| 3 | `/jobTasks` | GET | Job Task Lines — the BC sub-task records that planning lines hang off | Auto-task-order automation (Ask #5 from BC brief) |
| 4 | `/projectPlanningEntries` | GET | Denormalized planning summary across lines + tasks + steps | Single-call hydration for the "load full week" path |
| 5 | `/projectPlanningLines` | GET | **The big one.** `lineNo`, `type` (Resource/Item/Cost/Text), `description`, `quantity`, `unitOfMeasure`, planning date, `resourceNo` | **Stage 2 of Add Job** — `?$filter=jobNo eq '{jobNo}' and type eq 'Resource'` |
| 6 | `/projectPlanningSteps` | GET | Infotech custom step config — the dept-flow stages (Routing → Metal → Paint → …) per job | Custom task order per job; powers the per-job dept-flow override |
| 7 | `/TripsResources` | GET | Install trips + assigned resources (crews + trucks) | Install crew/truck badge (2M·1T) — replaces the standalone CrewAssignment mirror |
| 8 | `/dimensionSetEntries` | GET | BC dimensions — `dimensionCode` + `dimensionValueCode` pairs (cost center, region, location, dept) | **Department auto-resolve** if a `PRODUCTION_DEPT` dimension exists — preferred over the keyword regex |
| 9 | `/jobOutstandingPurchaseLines` | GET | POs raised against the job not yet received | Material-readiness signal — block install scheduling until material is in |
| 10 | `/jobReceivedNotInvoicedPurchaseLines` | GET | Received items not yet billed | WIP indicator — material is on-site, ready to consume |
| 11 | `/jobLedgerEntries` | GET | Posted activity (time, items, expenses) | History tab on a JobCard — what's actually been done vs scheduled |
| 12 | `/jobCostAndSales` | GET | Actual cost + billed sales totals per job; supports `?$filter=no eq '23743'` to scope to one | $ value toggle + week/month roll-up; completion % |
| 13 | `/companies` (standard BC, not Sign365) | GET | List of BC companies in the tenant | Multi-company support if NEK ever splits into its own |

### OData query patterns we'll actually use

```http
# Hydrate one job for the Add Job slide-over
GET /jobs?$filter=no eq '{jobNo}'
GET /projectPlanningLines?$filter=jobNo eq '{jobNo}' and type eq 'Resource'
GET /projectPlanningSteps?$filter=jobNo eq '{jobNo}'
GET /dimensionSetEntries?$filter=tableId eq 1003 and parentSubtype eq {planningLineNo}

# Full nightly mirror (paginated)
GET /jobs?$top=500&$orderby=lastModifiedDateTime desc

# Delta sync — read everything modified since the last sync timestamp
GET /jobs?$filter=lastModifiedDateTime gt 2026-06-23T00:00:00Z&$top=500
```

---

## 4 · Power Automate sync pattern

The architecture is **Sign365 → Power Automate → Dataverse → Weekly Calendar**. Apps never call Sign365 directly — Power Automate is the only thing that holds the BC client secret.

### Canonical flow shape (one per endpoint)

```
[Trigger: Recurrence]                    every 10 min for hot tables, 30 min for warm
   │
   ▼
[Get last sync timestamp]                Dataverse: crfdf_bcsyncstate row keyed by table name
   │
   ▼
[HTTP — Get OAuth token]                 POST to login.microsoftonline.com (Secure I/O ON)
   │   uses environment variable referencing Key Vault for the secret
   ▼
[HTTP — GET Sign365 endpoint]            with $filter=lastModifiedDateTime gt {lastSync}
   │   pagination via @odata.nextLink loop
   ▼
[Parse JSON]                             Schema generated from a sample response
   │
   ▼
[Apply to each record]
   ├─ [Lookup existing Dataverse row by natural key]
   └─ [Add a new row / Update a row]     Upsert pattern
   │
   ▼
[Update sync timestamp]                  Patch crfdf_bcsyncstate.lastSyncAt = utcNow()
   │
   ▼
[Catch failures]                         Try/Catch — on error: post to Teams ops channel
```

### Recommended sync cadence

| Tier | Endpoints | Cadence | Reason |
|---|---|---|---|
| **Hot** | `/jobs`, `/projectPlanningLines`, `/projectPlanningSteps`, `/jobTasks`, `/dimensionSetEntries` | every 5–10 min | Drive the Add Job picker; users feel staleness immediately |
| **Warm** | `/TripsResources`, `/projectDetails`, `/projectPlanningEntries` | every 15–30 min | Tooltip / metadata; staleness is acceptable |
| **Cool** | `/jobCostAndSales`, `/jobLedgerEntries`, `/jobOutstandingPurchaseLines`, `/jobReceivedNotInvoicedPurchaseLines` | every 30 min | $ totals / WIP — rollups, not transactional |
| **Cold** | `/companies` | daily | Rarely changes |

### Why not call Sign365 from the Code App directly?

1. **Secret containment** — the BC client secret stays in Power Automate / Key Vault; the Code App's bundle never sees it.
2. **Rate-limit smoothing** — Power Automate caches in Dataverse; the Code App reads from Dataverse with no BC quota cost.
3. **Cross-app reuse** — Estimating, Sales Hub, future Time & Photo Capture all read the same mirror; no duplicate BC reads.
4. **Offline / slow-network resilience** — Dataverse has retry + caching the Code App can use.
5. **Audit trail** — every BC read shows up in flow run history with timestamps; useful for diagnosing "why didn't job X show up at 2pm."

---

## 5 · Dataverse mirror tables

One Dataverse table per Sign365 endpoint. Prefix `crfdf_bc` to mark them as mirrors (vs. native Switchboard tables which use `crfdf_`).

| Sign365 endpoint | Dataverse table | Natural key | Notes |
|---|---|---|---|
| `/jobs` | `crfdf_bcjob` | `crfdf_jobno` | Lookup target from `crfdf_productionscheduleline.crfdf_jobno` |
| `/projectDetails` | `crfdf_bcjobdetail` | `crfdf_jobno` | 1:1 with `crfdf_bcjob` — store as related rows or denormalize onto the job |
| `/jobTasks` | `crfdf_bcjobtask` | `crfdf_jobno + crfdf_jobtaskno` | Composite key — enforce uniqueness via Dataverse alt-key |
| `/projectPlanningLines` | `crfdf_bcplanningline` | `crfdf_jobno + crfdf_lineno` | **Stage 2 of Add Job reads from here.** Index on `(jobno, type)` |
| `/projectPlanningSteps` | `crfdf_bcplanningstep` | `crfdf_jobno + crfdf_stepno` | Per-job dept order override |
| `/projectPlanningEntries` | `crfdf_bcplanningentry` | `crfdf_entryno` | Optional — denormalized view; skip if planning lines + tasks suffice |
| `/TripsResources` | `crfdf_bctripresource` | `crfdf_tripno + crfdf_resourceno` | Drives crew/truck badge |
| `/dimensionSetEntries` | `crfdf_bcdimensionentry` | `crfdf_dimensionsetid + crfdf_dimensioncode` | Department auto-resolve reads `WHERE dimensioncode = 'PRODUCTION_DEPT'` |
| `/jobOutstandingPurchaseLines` | `crfdf_bcoutstandingpo` | `crfdf_docno + crfdf_lineno` | |
| `/jobReceivedNotInvoicedPurchaseLines` | `crfdf_bcrcvdnotinv` | `crfdf_docno + crfdf_lineno` | |
| `/jobLedgerEntries` | `crfdf_bcjobledger` | `crfdf_entryno` | High-volume; consider partitioning by year |
| `/jobCostAndSales` | `crfdf_bccostandsales` | `crfdf_jobno` | Drives $ toggle + completion %; rebuild on each sync rather than upsert |
| `/companies` | `crfdf_bccompany` | `crfdf_companyid` | Static; rarely changes |
| (sync infra) | `crfdf_bcsyncstate` | `crfdf_tablename` | One row per mirror table — tracks `lastSyncAt`, `lastDeltaCount`, `lastError` |

### Suggested columns on `crfdf_bcplanningline` (the load-bearing one)

```
crfdf_planninglineid          (primary key — guid)
crfdf_jobno                   (text, indexed)
crfdf_lineno                  (whole number)
crfdf_type                    (option set: Resource | Item | Cost | Text)
crfdf_description             (text 250)
crfdf_quantity                (decimal 0.01)
crfdf_unitofmeasure           (text 20)
crfdf_planningdate            (date)
crfdf_startingtime            (time)
crfdf_endingtime              (time)
crfdf_resourceno              (text 20 — links to BC Resource = Employee)
crfdf_jobtaskno               (text 20 — links to crfdf_bcjobtask)
crfdf_dimensionsetid          (whole number — joins to crfdf_bcdimensionentry)
crfdf_lastmodifiedat          (datetime — populated from BC's lastModifiedDateTime)
crfdf_syncedat                (datetime — when the mirror picked it up)
crfdf_sourcerowversion        (text — for optimistic concurrency on the next sync)
```

---

## 6 · How the Weekly Calendar Code App reads this

The Code App is registered in alex smith's PowerApps environment and lives there — this doc lives in the Switchboard repo only because the Sign365 contract is shared infrastructure.

### Add Job slide-over → BC search flow

```
User types "J35899" in the search box
  │
  ▼
Code App: bcService.searchJob("J35899")
  │   reads Dataverse: SELECT * FROM crfdf_bcjob WHERE crfdf_jobno = 'J35899'
  │   (NO direct call to Sign365)
  ▼
Code App: bcService.getPlanningLines(jobNo)
  │   reads Dataverse: SELECT * FROM crfdf_bcplanningline
  │     WHERE crfdf_jobno = 'J35899' AND crfdf_type = 'Resource'
  │     ORDER BY crfdf_lineno
  ▼
Render the planning-line picker — instant, no network wait
```

### Replace the keyword regex with a real Dataverse lookup

In the prototype, `mapPlanningLine(description)` uses regex against the description. With `/dimensionSetEntries` mirrored, swap to:

```ts
// pseudocode — in the Code App's planning-line-mapping service
async function resolveDepartment(planningLine: BcPlanningLine): Promise<DepartmentId | null> {
  const entry = await dataverse.query(
    "crfdf_bcdimensionentry",
    `crfdf_dimensionsetid eq ${planningLine.dimensionSetId} and crfdf_dimensioncode eq 'PRODUCTION_DEPT'`,
  );
  if (entry.length > 0) {
    return mapDimensionValueToDeptId(entry[0].crfdf_dimensionvaluecode);
  }
  // Fallback to keyword rules when no dimension is set
  return mapPlanningLineByKeyword(planningLine.description);
}
```

This is **exact mapping** (zero string matching) for every job that has the dimension set, with the keyword fallback only for jobs missing the dimension. Strictly better than Canvas's behavior.

---

## 7 · The write-back gap

This collection is **read-only**. Every endpoint is GET. To write scheduling decisions back to BC you need either:

1. **Infotech to ship POST/PATCH endpoints** in a Sign365 v2 — request:
   - `POST /projectPlanningLines` — set `planningDate`, `startingTime`, `endingTime`, `noOfResources`
   - `PATCH /projectPlanningLines({id})` — for moves / resizes / employee reassignments
   - `POST /jobJournalLines` — for time posting from Time & Photo Capture clock-in/out (Ask #6 in the BC integration brief)
2. **OR** use the standard BC OData v4 endpoints directly (`/v2.0/.../api/v2.0/companies({id})/jobJournalLines`) and bypass Sign365 for writes.

Either way, the seven write operations from `docs/14-bc-write-operations.md` (start, end, employee, department, duration, lock, custom) get implemented as a separate set of Power Automate flows that the Code App triggers when the supervisor commits a change. Idempotent operation IDs — so retries are safe.

---

## 8 · Security checklist

- [ ] BC client secret stored in **Azure Key Vault**, referenced via Power Platform environment variable
- [ ] No secret in any repo, gist, screenshot, or chat tool
- [ ] Flow runs configured with **Secure Inputs / Secure Outputs ON** for the token request action
- [ ] Separate Entra app registrations for UAT and Prod — never share secrets across environments
- [ ] Calendar reminder set to rotate secrets every 6 months
- [ ] If a secret has been exposed (uploaded to chat, committed, screenshot): rotate **immediately** in Entra ID
- [ ] Power Automate flows scoped to least-privilege Entra app permissions (`https://api.businesscentral.dynamics.com/.default` is fine — it inherits the BC permission set assigned to the app user)
- [ ] BC `App User` configured with read-only permission set on the Sign365 entities; tighten further if/when write endpoints land

---

## 9 · Open questions for Infotech

Before standing up the mirror flows in earnest, get answers on:

1. Does `/projectPlanningLines` carry `lastModifiedDateTime` so we can run delta syncs?
2. What's the OData server-side page size cap? Does `@odata.nextLink` work?
3. Are there webhooks / change-tracking endpoints, so we can react to BC changes in seconds instead of minutes?
4. Does Lumineo's BC instance use a `PRODUCTION_DEPT` dimension on planning lines, or do we need to set one up?
5. Does `/projectPlanningSteps` define the custom task order per job, or is it more like a status pipeline?
6. UAT vs Prod creds — when can we have a separate Prod client secret + environment?
7. POST/PATCH roadmap for write-back — any ETA?

---

## 10 · Related docs

- [`docs/04-dataverse-schema.md`](04-dataverse-schema.md) — the Switchboard-native Dataverse tables (schedule lines, employees, departments, custom cards). The `crfdf_bc*` mirror tables defined here lookup-link into those.
- [`SIGN-BUILDER-PRO-HANDOFF.md`](SIGN-BUILDER-PRO-HANDOFF.md) — Sign Builder Pro's BC handoff format; some shared patterns.
- [`docs/01-architecture-overview.md`](01-architecture-overview.md) — where Power Automate fits in the broader Switchboard architecture.
