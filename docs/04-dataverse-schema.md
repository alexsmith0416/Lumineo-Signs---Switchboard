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
```

## Why polymorphic Photo

`Photo.relatedTo` lets one table serve every app that needs to attach an image — a progress photo on a Task, a completion shot on a Job, a reference photo on a SignSpec. The home-screen "recent completion photo reel" is just `Filter(Photo, isShowcase = true, takenAt > Today() - 30)`.

## A note on Business Central connector limits

The native BC connector throttles aggressively (~600 calls/minute per environment). For high-traffic reads (e.g. Sales Hub listing 5,000 customers), prefer:

1. Virtual tables (no caching but predictable),
2. A nightly Power Automate that syncs a slimmed `bc_Customer_Cache` Dataverse table for typeahead/search, with virtual tables for the detail view.
