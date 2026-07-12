# Importing the corrected BC sync flows & verifying

Corrected solution package: **`C:\Users\Alex\Downloads\BCSyncReview_1_0_0_2.zip`**
(unmanaged, version 1.0.0.2, contains all 5 flows). Source flow definitions live
next to this file and are the reviewable record of every change.

## What changed (per flow)

| Flow | Fix |
|---|---|
| **BCSync_Jobs** | Customer/ship-to join rewritten: reads `crfdf_bccustomers` and matches `crfdf_customerno == billToCustomerNo` (was `crfdf_customers` / `crfdf_customerid`, never matched). `crfdf_customername` now gets the real name; ship-to filled from the customer address. Added `crfdf_promiseddate` ← `endingDate`. Stripped a stray tab on ship-to state. Insert path now writes the full field set, not a sparse subset. |
| **BCSync_JobPlanningLines** | Removed leading TAB characters from 8 mapped values (description, planning date, total price, resource no, line type, type) that were being stored literally. |
| **BCSync_Customers** | Update path `crfdf_postalcode` was mapped to `phoneNumber`; now maps to `postalCode`. |
| **BCSync_SalesLines** | `recordId` was the literal text `"crfdf_bcjobid"` in all 3 update actions → every write failed. Now `@items('Apply_to_each_BC_Job')?['crfdf_bcjobid']`. Expanded `$select` so the fallback name/description are available. **Added `crfdf_remainingbalance` ← salesLine `outstandingAmountLCY`.** |
| **BCSync_BillingLines** (NEW) | Nightly sync of BC **Billable** job planning lines into `crfdf_bcbillinglines` (amount ← `lineAmountLCY`, total price ← `totalPriceLCY`, dates ← `planningDate`). Feeds the app's invoicing rollup. |

### Known-empty by design (not bugs)
- `crfdf_bcbillingline.crfdf_invoicedamount` / `crfdf_remainingamount` — not available
  on analytics job planning lines; would come from `jobLedgerEntry` (Sale entries). Left
  null (app reads them as 0) rather than filled with a guess.

> Note: `crfdf_bcjob.crfdf_remainingbalance` is now filled by BCSync_SalesLines from the
> order's salesLine `outstandingAmountLCY` (first Order line; if a job's order routinely
> spans multiple lines and you need the summed balance, that's a small follow-up).

## Import steps (in the browser you're signed into)

1. Top-right **environment picker** → switch to **Alex Smith's Environment**
   (`484cdd3c-4409-e741-bbd5-7c210e00310e`) — the one that has these flows. **This is
   critical**; importing into the Default environment would create orphans.
2. Left nav → **Solutions** → **Import solution**.
3. **Browse** → select `BCSyncReview_1_0_0_2.zip` → **Next**.
4. When prompted, map the two **connection references** to your existing connections:
   - *Microsoft Dataverse* → your Dataverse connection
   - *Dynamics 365 Business Central* → your BC connection
5. **Import**. Wait for "succeeded".

## Troubleshooting: "unpublished active row" import error

If import fails with *"You are attempting to do a published update of a publishable
component in an unmodified active context when there exists an unpublished active row …
Component Type: 29 … CurrentState=ActiveUnpublished"*, the target flow has an
**unpublished draft**. Microsoft's fix: ensure no unpublished drafts before importing.

1. Open each existing `BCSync_*` flow → **Edit** → **Save**, then **Publish** if prompted,
   so no "unpublished changes" indicator remains.
2. Re-import the solution.

(The import is transactional — a failure rolls back fully, so existing flows are unchanged.)

## After import

- Solution-imported cloud flows can land **turned off**. Open each of the 5 flows and
  confirm it's **On** (turn on if needed).
- Optionally **Run** (or "Test") `BCSync_Jobs` once, then `BCSync_JobPlanningLines`,
  `BCSync_SalesLines`, `BCSync_BillingLines` (they depend on `crfdf_bcjobs` being fresh),
  so you don't wait for the nightly schedule.

## Verify the data is now correct

In the scheduler (or a Dataverse table view), after the flows run once:

1. **Customer names** — `crfdf_bcjobs.crfdf_customername` should show real customer
   names, not the job description.
2. **Promised dates** — `crfdf_bcjobs.crfdf_promiseddate` populated (from `endingDate`).
3. **Customers postal code** — spot-check a customer: `crfdf_bccustomers.crfdf_postalcode`
   is a ZIP, not a phone number.
4. **Sales line fields** — `crfdf_bcjobs.crfdf_saleslinefound` / `crfdf_appjobname`
   populated (SalesLines now writes successfully).
5. **Billing lines** — `crfdf_bcbillinglines` has rows with `crfdf_amount` set.
6. **Remaining balance** — `crfdf_bcjobs.crfdf_remainingbalance` populated for jobs that
   have an open sales order (from salesLine `outstandingAmountLCY`).

In the app, the scheduler already tolerates the old empties, so nothing should break;
job cards should now show correct customer names sourced end-to-end.
