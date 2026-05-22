# 04 — Dataverse Schema & Business Central Integration

## Principle

**Business Central is the system of record** for customers, items, sales orders, invoices, and vendors. Don't duplicate that data — read it through Dataverse virtual tables, write back through Power Automate. Dataverse owns everything operational that BC doesn't model (jobs, tasks, photos, time entries, sign specs, announcements, KPIs).

## Shared Dataverse tables

| Table | Owner app(s) | Notes |
|---|---|---|
| `UserProfile` | Switchboard | One row per Entra user; cached role, department, birthday, photo, phone |
| `Job` | Project Scheduler | The central work unit. Linked to BC Sales Order |
| `Task` | Weekly Scheduler | Belongs to a Job; assigned to a dept + person; has scheduled date |
| `TimeEntry` | Time & Photo | Clock-in/out against a Task |
| `Photo` | Time & Photo, Sign Builder | Image + caption + linked Task/Job/SignSpec |
| `SignSpec` | Sign Builder Pro | The build sheet: dimensions, materials, art files, BOM |
| `Opportunity` | Sales Hub | Pre-Job; converts into a Job when Won |
| `Announcement` | Switchboard (Ops only edit) | Per-group home-screen messages |
| `Event` | Switchboard | Holidays, company events, deadlines |
| `SafetyMetric` | Switchboard (Ops only edit) | Singleton row: current Days Since Lost Time streak + record |
| `SafetyIncident` | Switchboard | History of safety incidents, drives counter resets |
| `KpiSnapshot` | Switchboard (system) | Precomputed KPI rows for fast splash loads |
| `CrewAssignment` | Switchboard / Weekly Scheduler | Crew + truck + equipment per Task; drives 2M 1T badge |
| `WeatherCache` | Switchboard | Cached daily weather by ZIP, dodges API quota |
| `Spotlight` | Switchboard (Ops only edit) | Weekly featured employee or project (Phase 6) |
| `Suggestion` | Switchboard | Employee suggestion box submissions (Phase 6) |
| `SystemConfig` | Switchboard (Ops only) | Per-sub-app `enabled` flag + `maintenanceMessage` |
| `PendingBCWrites` | All apps (write-only) | Queue of BC-bound writes accumulated during the Airtable-bridge interim. Drained when BC API access lands. See [doc 13](13-airtable-bridge-mapping.md). |
| `SyncLog` | System | Diagnostic log for AirtableMirror_Sync and future BCSync flows; ≤7 day retention. |

## Virtual tables (read from BC, no copy)

| Virtual table | Backed by BC entity |
|---|---|
| `bc_Customer` | `customer` |
| `bc_Item` | `item` |
| `bc_SalesOrder` | `salesOrder` |
| `bc_SalesOrderLine` | `salesOrderLine` |
| `bc_Vendor` | `vendor` |
| `bc_Inventory` | `itemLedgerEntry` (aggregated) |

A `Job` row carries `bcSalesOrderId` as a lookup to `bc_SalesOrder`. The app shows live BC fields (order status, ship date, totals) without ever copying them.

## Write-back to BC (Power Automate)

These flows live in the `Platform` Linear project:

| Trigger | Flow | Writes to BC |
|---|---|---|
| Sales Hub: Opportunity → Won | `CreateSalesQuote` | `salesQuote` + lines |
| Sales Hub: Quote accepted | `ConvertQuoteToOrder` | `salesOrder` |
| Time & Photo: Install complete | `MarkOrderShipped` | `salesOrder.status = Shipped` |
| Time & Photo: Final sign-off | `TriggerInvoicing` | `salesInvoice` |
| Project Scheduler: Materials request | `CreatePurchaseOrder` | `purchaseOrder` |

## Schema sketch — the core tables

```
UserProfile
├─ userId (PK, Entra OID)
├─ email
├─ displayName
├─ role (Operations | Sales | Production | Installation | Shipping)
├─ department
├─ birthday
├─ phone
├─ photo (file)
└─ active (bool)

Job
├─ jobId (PK)
├─ jobNumber (auto, e.g. J-2026-0142)
├─ name
├─ customerId → bc_Customer (virtual)
├─ bcSalesOrderId → bc_SalesOrder (virtual)
├─ status (Quoted | Scheduled | In Production | Installing | Complete | Invoiced)
├─ startDate
├─ dueDate
├─ assignedTeamLead → UserProfile
├─ percentComplete (rollup from Tasks)
└─ notes

Task
├─ taskId (PK)
├─ jobId → Job
├─ title
├─ department (Production | Installation | Shipping)
├─ assignedTo → UserProfile
├─ scheduledDate
├─ estimatedHours
├─ status (Not Started | In Progress | Blocked | Done)
└─ priority

TimeEntry
├─ entryId (PK)
├─ taskId → Task
├─ userId → UserProfile
├─ clockIn (datetime)
├─ clockOut (datetime)
├─ durationMinutes (calc)
└─ notes

Photo
├─ photoId (PK)
├─ relatedTo (polymorphic → Task | Job | SignSpec)
├─ relatedId
├─ image (file, ≤128 MB or SharePoint pointer)
├─ caption
├─ takenBy → UserProfile
├─ takenAt
└─ isShowcase (bool — shows on home reel)

SignSpec
├─ specId (PK)
├─ jobId → Job (optional — exists pre-Job too)
├─ opportunityId → Opportunity (optional)
├─ widthIn, heightIn, depthIn
├─ materials (json)
├─ bom (json — links to bc_Item rows)
├─ artFiles (file collection)
├─ approvedBy → UserProfile
└─ approvedAt

Opportunity
├─ oppId (PK)
├─ customerId → bc_Customer (virtual)
├─ stage (Lead | Qualified | Quoted | Won | Lost)
├─ estValue
├─ owner → UserProfile
├─ expectedCloseDate
├─ convertedJobId → Job
└─ bcSalesQuoteId → BC virtual

Announcement
├─ id (PK)
├─ title
├─ body (rich text)
├─ audience (Operations | Sales | Production | Installation | Shipping | All)
├─ publishAt
├─ expireAt
└─ pinned

Event
├─ id (PK)
├─ title
├─ type (Holiday | Birthday | CompanyEvent | Deadline)
├─ startDate
├─ endDate
└─ audience

SafetyMetric (singleton "current" row + history)
├─ id (PK)
├─ currentStreakStartDate (date)
├─ longestStreakDays (int)
├─ longestStreakEndDate (date)
└─ updatedAt

SafetyIncident
├─ id (PK)
├─ incidentDate (date)
├─ description (text)
├─ category (Lost-Time | Recordable | Near-Miss | First-Aid)
├─ employeeInvolved → UserProfile (optional)
├─ daysStreakAtIncident (int)
└─ loggedBy → UserProfile

KpiSnapshot
├─ id (PK)
├─ key (string, e.g. "revenue_this_week")
├─ audience (Operations | Sales | Production | Installation | Shipping | All)
├─ label (string, "Revenue This Week")
├─ value (decimal)
├─ valueFormat (currency | int | hours | percent)
├─ deltaValue (decimal)
├─ deltaDirection (up | down | flat)
├─ deltaIsGood (bool)
├─ sparkline (string — CSV last 7 points)
├─ computedAt (datetime)
└─ link (string — optional deep-link)

CrewAssignment
├─ id (PK)
├─ taskId → Task
├─ persons (int)
├─ trucks (int)
├─ cranes (int, optional)
├─ lifts (int, optional)
├─ buckets (int, optional)
├─ source (Auto-BC | Manual)
├─ overrideReason (text)
├─ assignedPersons (collection → UserProfile)
├─ assignedTrucks (collection)
├─ computedAt (datetime)
└─ updatedBy → UserProfile

WeatherCache
├─ id (PK)
├─ zip (string, 5 chars)
├─ forDate (date)
├─ tempHigh (int, °F)
├─ tempLow (int, °F)
├─ condition (Sunny | Partly Cloudy | Cloudy | Rain | T-Storm | Snow | Wind)
├─ conditionIcon (string — OpenWeather code)
├─ precipPct (int)
├─ windMph (int)
├─ windDir (string)
├─ alerts (json)
├─ fetchedAt (datetime)
└─ source (OpenWeather | NOAA | manual)

Spotlight (Phase 6)
├─ id (PK)
├─ kind (Employee | Project)
├─ title
├─ body (rich text)
├─ heroImage (file)
├─ featureFrom (date)
├─ featureTo (date)
└─ linkedRecordId (UserProfile or Job)

Suggestion (Phase 6)
├─ id (PK)
├─ submittedBy → UserProfile (optional if anonymous)
├─ body (text)
├─ status (New | Reviewing | Planned | Done | Declined)
├─ category (Process | Tooling | Safety | Culture | Other)
└─ submittedAt

SystemConfig
├─ appKey (PK, e.g. "weeklyScheduler")
├─ enabled (bool)
├─ maintenanceMessage (text)
└─ updatedAt

PendingBCWrites (interim queue; drained when BC API lands)
├─ id (PK)
├─ entityType (Job | Task | TimeEntry | Photo | Opportunity | SignSpec)
├─ entityId (string — the Dataverse row id of the source record)
├─ operation (CreateSalesQuote | ConvertQuoteToOrder | MarkOrderShipped
│             | TriggerInvoicing | CreatePurchaseOrder | UpdateSalesOrderLine
│             | PostTimeEntries | ...)
├─ payload (json — the BC-shaped body ready to POST)
├─ status (Pending | InFlight | Posted | Failed | Skipped)
├─ attempts (int)
├─ lastAttemptAt (datetime)
├─ lastError (text)
├─ bcRef (text — BC's returned identifier on success)
├─ createdAt (datetime)
└─ createdBy → UserProfile

SyncLog
├─ id (PK)
├─ flow (string — "AirtableMirror_Sync" | "BCSync" | "PendingBCWrites_Drain")
├─ startedAt (datetime)
├─ finishedAt (datetime)
├─ rowsProcessed (int)
├─ rowsFailed (int)
├─ errorSummary (text — JSON list of {recordId, field, message})
└─ runId (string — Power Automate run identifier)
```

## Interim data source — Airtable bridge

Until BC API admin access is granted, the operational tables (`Job`, `Task`, `CrewAssignment`) are populated by a Power Automate flow that mirrors the manually-maintained Airtable base `"LNI Production Schedule"` into Dataverse every 15 minutes. Apps still read/write only to Dataverse. Writes that need to reach BC are queued in `PendingBCWrites` and drained when the BC API arrives. Full field-by-field mapping, decomposition rules, and switch-over plan: **[doc 13 — Airtable Bridge](13-airtable-bridge-mapping.md)**.

## Why polymorphic Photo

`Photo.relatedTo` lets one table serve every app that needs to attach an image — a progress photo on a Task, a completion shot on a Job, a reference photo on a SignSpec. The home-screen "recent completion photo reel" is just `Filter(Photo, isShowcase = true, takenAt > Today() - 30)`.

## A note on Business Central connector limits

The native BC connector throttles aggressively (~600 calls/minute per environment). For high-traffic reads (e.g. Sales Hub listing 5,000 customers), prefer:

1. Virtual tables (no caching but predictable),
2. A nightly Power Automate that syncs a slimmed `bc_Customer_Cache` Dataverse table for typeahead/search, with virtual tables for the detail view.
