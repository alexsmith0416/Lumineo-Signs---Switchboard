# 14 — BC Write Operations (Payload Schemas)

## Purpose

Apps emit `lum_PendingBCWrites` rows whenever they perform an action that *will eventually* need to reach Business Central. Until BC API access lands (see [doc 13](13-airtable-bridge-mapping.md)), these rows accumulate; `PendingBCWrites_Drain` (Linear ALE-170) posts them to BC at cutover.

This doc defines the **payload shape** for each `operation` value so apps and the drain flow agree on the contract from day 1.

> **Source of truth:** payload shapes follow the [Business Central API v2.0](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/api-reference/v2.0/) standard entities. Where Lumineo's BC company has custom fields, this doc calls them out as `lumineoCustom_*`. Verify customizations during the BC service-principal setup (Linear ALE-120) and update this doc.

## Common envelope

Every queue row has the same outer shape; the `operation` field selects which payload schema below applies.

```jsonc
{
  // lum_PendingBCWrites row
  "id": "<guid>",
  "entityType": "Opportunity",            // source Dataverse table
  "entityId": "<dataverse-guid>",         // source row id
  "operation": "CreateSalesQuote",        // selects schema below
  "payload": { /* operation-specific, see below */ },
  "status": "Pending",
  "attempts": 0,
  "createdAt": "2026-05-22T14:30:00Z",
  "createdBy": "<userProfileId>"
}
```

The `payload` field is JSON-encoded text in Dataverse. Apps build the object using the schema below, then `JSON()` (Power Fx) or `JSON.stringify` (TypeScript) before writing.

## Idempotency strategy

Each operation defines an **idempotency key** — a deterministic value the drain flow stamps on the BC payload (as `externalDocumentNumber` where supported, or a custom field) so retries don't double-post.

| Operation | Idempotency key | BC field used |
|---|---|---|
| `CreateSalesQuote` | `oppId` | `externalDocumentNumber` on `salesQuote` |
| `ConvertQuoteToOrder` | `oppId` | `externalDocumentNumber` on `salesOrder` |
| `MarkOrderShipped` | `jobId + ":shipped"` | `lumineoCustom_extRef` on PATCH |
| `TriggerInvoicing` | `jobId + ":invoice"` | `externalDocumentNumber` on `salesInvoice` |
| `CreatePurchaseOrder` | `jobId + ":po:" + materialRequestId` | `externalDocumentNumber` on `purchaseOrder` |
| `UpdateSalesOrderLine` | `bcSalesOrderLineId + ":" + fieldName + ":" + valueHash` | (none — drain skips if `bcRef` exists for same `entityId+operation+hash`) |
| `PostTimeEntries` | `jobId + ":" + weekStartDate` | `externalDocumentNumber` on `jobJournalBatch` |

The drain flow's pre-check is:
1. Look up BC entity by idempotency key
2. If found → mark queue row `Posted`, store `bcRef`, skip POST
3. If not found → POST, capture `bcRef` from response

This makes the queue safe to replay and resistant to network failures.

## Validation contract

Apps **must** validate payloads before writing the queue row. The drain flow assumes payloads are well-formed; malformed rows go to `status=Failed` on first attempt without retry.

Universal rules:
- All ISO dates use `YYYY-MM-DD` (BC API expects this)
- All ISO datetimes use UTC `YYYY-MM-DDTHH:mm:ssZ`
- All money values use decimals with 2 places, no currency symbols
- BC entity references use the `id` (GUID) format, not display numbers, unless a `*Number` field is explicitly available
- Empty optional fields → omit from payload (do NOT send `null` or `""`)

---

## Operation 1: `CreateSalesQuote`

Sales Hub fires this when a user marks an Opportunity as **Won**.

### Trigger
- App: Sales Hub
- Source row: `lum_Opportunity` where `stage` transitions to `Won`
- Also creates: a new `lum_Job` row (the converted Job)

### Dataverse source
| Source field | → BC payload field |
|---|---|
| `Opportunity.customerId` | `customerId` (or `customerNumber` if cache used) |
| `Opportunity.estValue` | informs line `unitPrice` × `quantity` (optional — quote may carry many lines) |
| `Opportunity.owner.email` | `salespersonCode` (lookup BC salesperson by email) |
| `Opportunity.expectedCloseDate` | `validUntilDate` |
| current date | `documentDate` |

### Payload schema
```jsonc
{
  // Header
  "header": {
    "customerNumber": "10000",            // required — from bc_Customer_Cache or Opportunity.customerNumber
    "documentDate": "2026-05-22",         // required
    "validUntilDate": "2026-06-21",       // optional, defaults to +30d
    "salespersonCode": "AS",              // optional
    "currencyCode": "USD",                // optional, defaults to company default
    "externalDocumentNumber": "OPP-<oppId>", // idempotency key
    "lumineoCustom_oppId": "<oppId>"      // back-reference for reconciliation
  },
  // Lines (1..N)
  "lines": [
    {
      "sequence": 10000,                  // BC convention: 10000, 20000, 30000…
      "lineType": "Item",                 // Item | Account | Resource | Comment
      "lineObjectNumber": "SIGN-LED-4x8", // BC item code or G/L account
      "description": "4x8 LED sign — custom",
      "quantity": 1,
      "unitOfMeasureCode": "EA",
      "unitPrice": 8500.00,
      "discountAmount": 0,
      "shipmentDate": "2026-07-15"        // optional install target
    }
  ]
}
```

### Validation before queueing
- `header.customerNumber` resolved via bc_Customer_Cache lookup (not free-text)
- At least 1 line
- Every line has `lineObjectNumber`, `quantity > 0`, `unitPrice >= 0`
- `documentDate` ≤ `validUntilDate`

### BC response → `bcRef`
The drain flow stores the BC `salesQuote.id` (GUID) and `number` (e.g., `SQ-2026-0042`) joined with `|`:
```
"f47ac10b-58cc-4372-a567-0e02b2c3d479|SQ-2026-0042"
```
Apps can parse `bcRef.split("|")[1]` to get the human-readable quote number.

### Edge cases
- **Customer not in BC cache yet**: Sales Hub blocks the Won transition with a "Sync customer to BC first" message. Operations adds the customer in BC, sync flow picks up, retry.
- **Quote already exists for this Opp** (re-attempt after partial failure): idempotency check finds it; queue row marked Posted without re-POST.

---

## Operation 2: `ConvertQuoteToOrder`

Sales Hub fires this when a customer accepts a quote (signature, deposit, etc.).

### Trigger
- App: Sales Hub
- Source row: `lum_Opportunity` where `bcSalesQuoteId` is set AND `lumineoCustom_accepted=true`

### Payload schema
```jsonc
{
  "salesQuoteId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", // from Opportunity.bcSalesQuoteId
  "externalDocumentNumber": "OPP-<oppId>",   // same key as CreateSalesQuote — enables idempotent reconciliation
  "lumineoCustom_oppId": "<oppId>",
  "requestedDeliveryDate": "2026-07-15",     // optional, copies from quote if absent
  "overrideLines": []                        // optional — if any quote lines need adjustment at conversion
}
```

### BC behavior
BC's `salesQuotes/{id}/Microsoft.NAV.makeOrder` action converts the quote in-place. Response includes the new `salesOrder.id`.

### Validation
- `salesQuoteId` exists in BC (look up via virtual table)
- Quote `status = Open` (not already converted, not cancelled)
- No pricing changes since the quote was accepted (compare `Opportunity.estValue` to current quote total — alert if drift >5%)

### BC response → `bcRef`
`<salesOrder.id>|<salesOrder.number>`

### Edge cases
- **Quote cancelled in BC**: drain flow marks row `Failed` with reason "QuoteCancelled"; Sales Hub surfaces in Ops review.

---

## Operation 3: `MarkOrderShipped`

Time & Photo Capture fires this when an installer marks the install task complete.

### Trigger
- App: Time & Photo Capture
- Source row: `lum_Task` where `department=Installation AND status=Done`, only once per Job
- Also: the parent `lum_Job` status transitions to `Installed`

### Payload schema
```jsonc
{
  "salesOrderId": "<bcSalesOrderId>",        // from Job.bcSalesOrderId
  "patch": {
    "lumineoCustom_extRef": "<jobId>:shipped",  // idempotency
    "lumineoCustom_installedAt": "2026-07-15T14:32:00Z",
    "lumineoCustom_installedBy": "user@lumineo.com"
  },
  // For pure status updates, BC may require a state-transition action call
  // rather than a PATCH; the drain flow handles either based on Lumineo's BC config
  "action": "release"                        // optional — only if Lumineo's BC uses the Release action
}
```

### Validation
- `salesOrderId` is set on Job (Job was created via the bridge or via converted quote)
- Job's Installation task is `Done`
- No prior `MarkOrderShipped` row exists for this Job (check `lum_PendingBCWrites` for same `entityId + operation`)

### BC response → `bcRef`
`<salesOrder.number>:released:<timestamp>` — purely informational; no BC entity is created.

### Edge cases
- **Job has no `bcSalesOrderId`** (was created via Airtable mirror, never linked to BC): queue row goes to `status=Skipped` at drain time with reason "NoBCLinkage". Ops can manually reconcile.

---

## Operation 4: `TriggerInvoicing`

Time & Photo Capture (or Project Scheduler / Ops dashboard) fires this when final sign-off happens on a Job.

### Trigger
- App: Time & Photo Capture or Project Scheduler
- Source row: `lum_Job` where `dateToAdmin` is set (transition action)

### Payload schema
```jsonc
{
  "salesOrderId": "<bcSalesOrderId>",        // from Job.bcSalesOrderId
  "header": {
    "documentDate": "2026-07-20",
    "postingDate": "2026-07-20",             // optional, defaults to documentDate
    "externalDocumentNumber": "JOB-<jobId>:invoice",
    "lumineoCustom_jobId": "<jobId>"
  },
  "lineSelection": "all",                    // "all" | "specific"
  "specificLineIds": []                      // populated only when lineSelection="specific"
}
```

BC's `salesOrders/{id}/Microsoft.NAV.shipAndInvoice` action posts an invoice from an order. Response includes the new `salesInvoice.id`.

### Validation
- Sales order in BC is in `status=Released` (call `MarkOrderShipped` first if not)
- All planned lines are quantity-shipped (BC enforces this; pre-check avoids round-trip)

### BC response → `bcRef`
`<salesInvoice.id>|<salesInvoice.number>` (e.g., `…|INV-2026-0142`)

### Edge cases
- **Partial invoicing**: not supported in this version. Future enhancement — Sales Hub Phase 6.

---

## Operation 5: `CreatePurchaseOrder`

Project Scheduler fires this when an Ops user submits a materials-request form.

### Trigger
- App: Project Scheduler
- Source row: `lum_MaterialRequest` (NEW table — add to doc 04 when this app starts)
- Carries: requested items, vendor, target Job

### Payload schema
```jsonc
{
  "header": {
    "vendorNumber": "V001",                   // from bc_Vendor lookup
    "documentDate": "2026-05-22",
    "orderDate": "2026-05-22",
    "expectedReceiptDate": "2026-06-05",
    "buyFromAddressCode": "MAIN",             // optional
    "externalDocumentNumber": "JOB-<jobId>:po:<materialRequestId>",
    "lumineoCustom_jobId": "<jobId>",
    "lumineoCustom_materialRequestId": "<materialRequestId>"
  },
  "lines": [
    {
      "sequence": 10000,
      "lineType": "Item",
      "lineObjectNumber": "STEEL-2X4-10FT",
      "description": "Steel post 2x4 10ft",
      "quantity": 25,
      "unitOfMeasureCode": "EA",
      "directUnitCost": 18.50,
      "expectedReceiptDate": "2026-06-05",
      "lumineoCustom_relatedJobNo": "J123456"  // links PO line to Job for routing
    }
  ]
}
```

### Validation
- Vendor exists in `bc_Vendor` virtual table
- Every line item exists in `bc_Item`
- `expectedReceiptDate >= orderDate`

### BC response → `bcRef`
`<purchaseOrder.id>|<purchaseOrder.number>` (e.g., `…|PO-2026-0089`)

---

## Operation 6: `UpdateSalesOrderLine`

Project Scheduler / Sign Builder Pro fires this when a sign spec change forces an update to BC's sales order line (quantity, item, price).

### Trigger
- Apps: Project Scheduler, Sign Builder Pro
- Source row: `lum_SignSpec` or `lum_Job` change that affects the linked BC `salesOrderLine`

### Payload schema
```jsonc
{
  "salesOrderId": "<bcSalesOrderId>",
  "salesOrderLineId": "<bcSalesOrderLineId>",
  "patch": {
    "quantity": 2,
    "description": "4x8 LED sign — custom (revised)",
    "shipmentDate": "2026-07-22"
  },
  "fieldHash": "<sha1(jsonOfPatch)>",         // for idempotency
  "reason": "Customer requested 2 units instead of 1"
}
```

### Validation
- Order line in BC is in editable state (`status != Posted` on the parent order)
- `patch` contains only allowed fields (whitelist: `quantity`, `description`, `shipmentDate`, `unitPrice`, `discountAmount`)
- `reason` is required (audit trail)

### BC response → `bcRef`
`<salesOrderLineId>:patched:<fieldHash>`

### Edge cases
- **Order already shipped**: drain marks row `Failed` with reason "OrderPosted"; manual reconciliation in BC.

---

## Operation 7: `PostTimeEntries`

Time & Photo Capture fires this when an employee submits the previous week's timesheet (or at automated weekly close).

### Trigger
- App: Time & Photo Capture
- Source: aggregated `lum_TimeEntry` rows for one `userId` over one workweek

### Payload schema
```jsonc
{
  "jobJournalBatch": {
    "templateName": "JOB",                    // BC convention
    "batchName": "WEEKLY",                    // configurable
    "externalDocumentNumber": "JOB-<jobId>:tw:<weekStartDate>"
  },
  "lines": [
    {
      "sequence": 10000,
      "postingDate": "2026-05-18",            // for THIS day's entries; one line per (job, task, day)
      "jobNumber": "J123456",
      "jobTaskNumber": "INSTALL",
      "resourceNumber": "R-EMP-042",          // BC resource id for this user
      "workTypeCode": "REG",                  // REG | OT | TRAVEL — Lumineo-specific
      "quantity": 8.0,                        // hours
      "description": "Install — main entry sign",
      "lumineoCustom_timeEntryIds": ["<id1>", "<id2>"]  // back-link
    }
  ]
}
```

### Validation
- `userId` has a matching `bc_Resource.number` (mapped via Entra email)
- All `lum_TimeEntry` rows for the week have `clockOut` set (no open clocks)
- Aggregation by day, not by punch (BC expects daily totals)
- Total hours per day ≤ 24 (sanity check)

### BC response → `bcRef`
`<jobJournalBatch.code>:<weekStartDate>:<resourceNumber>`

### Edge cases
- **No BC resource mapping for user**: queue row → `Skipped`; Ops reviews `lum_PendingBCWrites` filter where `status=Skipped` to set up mapping, then sets row back to `Pending`.

---

## App-side reference table

For app developers — which operation each app emits:

| App | Operations it emits | When |
|---|---|---|
| **Sales Hub** | `CreateSalesQuote`, `ConvertQuoteToOrder` | Opp Won; Quote accepted |
| **Time & Photo Capture** | `MarkOrderShipped`, `TriggerInvoicing`, `PostTimeEntries` | Install done; final sign-off; weekly close |
| **Project Scheduler** | `CreatePurchaseOrder`, `UpdateSalesOrderLine`, `TriggerInvoicing` | Materials request; spec change; final sign-off |
| **Sign Builder Pro** | `UpdateSalesOrderLine` | Spec change after order exists |
| **Switchboard** | (none — emits no BC writes) | — |
| **Lumineo Scheduling Hub** | `UpdateSalesOrderLine` (scheduled date changes) | Drag/reschedule when linked to BC order |

## Implementation helpers

### Power Fx (Canvas apps)

```powerfx
// Helper that builds the queue row from an operation + payload
Set(gblBCQueueRow,
  {
    entityType: "Opportunity",
    entityId: SelectedOpportunity.id,
    operation: "CreateSalesQuote",
    payload: JSON({
      header: {
        customerNumber: SelectedOpportunity.customerNumber,
        documentDate: Text(Today(), "yyyy-mm-dd"),
        validUntilDate: Text(DateAdd(Today(), 30), "yyyy-mm-dd"),
        salespersonCode: User().Email,
        externalDocumentNumber: "OPP-" & SelectedOpportunity.id
      },
      lines: ForAll(colOppLines, {
        sequence: ThisRecord.lineSeq,
        lineType: "Item",
        lineObjectNumber: ThisRecord.itemCode,
        description: ThisRecord.description,
        quantity: ThisRecord.qty,
        unitOfMeasureCode: ThisRecord.uom,
        unitPrice: ThisRecord.unitPrice
      })
    }),
    status: "Pending",
    createdAt: Now(),
    createdBy: User().Email
  }
);
Patch('lum_PendingBCWrites', Defaults('lum_PendingBCWrites'), gblBCQueueRow);
```

### TypeScript (Code Apps)

```typescript
import { dataverse } from "@/services/dataverse";

type Operation =
  | "CreateSalesQuote"
  | "ConvertQuoteToOrder"
  | "MarkOrderShipped"
  | "TriggerInvoicing"
  | "CreatePurchaseOrder"
  | "UpdateSalesOrderLine"
  | "PostTimeEntries";

interface QueueRow {
  entityType: string;
  entityId: string;
  operation: Operation;
  payload: object;          // serialized to JSON before send
}

export async function queueBCWrite(row: QueueRow) {
  return dataverse.create("lum_PendingBCWrites", {
    ...row,
    payload: JSON.stringify(row.payload),
    status: "Pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    createdBy: dataverse.currentUser.id,
  });
}
```

A shared `payloads/` module per app can centralize the builder functions (`buildCreateSalesQuotePayload(opp, lines)`, etc.) so the structure stays consistent.

## Schema versioning

If a payload schema needs to change post-launch (BC API version bump, Lumineo customization added), include a `schemaVersion` field at the top of the payload:

```jsonc
{
  "schemaVersion": 2,                     // first version omits this
  "header": { ... }
}
```

The drain flow branches on `schemaVersion` to handle both old (queued before the bump) and new rows during the transition window.

## Open questions to resolve at BC service-principal setup (Linear ALE-120)

These need confirmation with the BC admin once access is granted; this doc is a best-effort against the standard BC v2.0 API:

1. **Customer/Vendor lookup convention** — does Lumineo use BC's GUID `id` or the display `number` as the primary join key? (Currently spec'd as `number` for human-readability; switch if needed.)
2. **Sales quote acceptance signal** — does Lumineo's BC use a custom field (`lumineoCustom_accepted`) or a status transition? Resolves whether `ConvertQuoteToOrder` queries a Dataverse flag or a BC quote field.
3. **Job journal posting** — Lumineo's BC may use `jobJournalLines` directly OR a custom posting screen. Confirm endpoint.
4. **Custom field names** — every `lumineoCustom_*` field in this doc is a placeholder; replace with the actual BC custom field name when verified.
5. **Worker/Resource mapping** — confirm how BC Resource ↔ M365 user mapping is maintained. The `seedResources` flow (Linear ALE-132 + BC sync) does this; this doc assumes Resource.email matches Entra UPN.

Once verified, update this doc and bump payload schemas to `version 2` if structural changes are needed.
