# BC → Dataverse sync flows

This folder holds exported **Power Automate** flow definitions for the flows that
mirror Business Central into the `crfdf_bc*` staging tables the scheduler reads.
They live in the Power Platform environment, **not** in app code — this is where
we stage their exports so we can review and correct the field mappings.

## The problem we're fixing

The scheduler compensates for several columns the sync leaves **empty or wrong**.
We want to fix these at the source (the flow), so the raw Dataverse data is clean:

| Table | Column | Current state | Should be |
|---|---|---|---|
| `crfdf_bcjobs` | `crfdf_jobno` | empty (only `crfdf_jobnumber` set) | populated, or standardize on one job-no column |
| `crfdf_bcjobs` | `crfdf_customername` | holds the **job description**, not the customer | the real bill-to customer name |
| `crfdf_bcplanninglines` | `crfdf_jobnumber` | empty (only `crfdf_jobno` set) | populated for a consistent join key |
| `crfdf_bcplanninglines` | `crfdf_no` | empty (only `crfdf_resourceno` set) | the line "No." (resource code) |
| `crfdf_bcplanninglines` | `crfdf_estimatedhours` | empty (only `crfdf_quantity` set) | the estimated hours |

## What to export (per flow)

For **each** flow that writes to a `crfdf_bc*` table (likely one per table —
jobs, planning lines, customers, billing lines):

1. Go to <https://make.powerautomate.com> and select the environment
   **Alex Smith's Environment** (`484cdd3c-4409-e741-bbd5-7c210e00310e`).
2. Find the sync flow (name probably mentions *BC* / *Business Central* / *sync*
   / *jobs* / *planning*). If unsure which write where, open the flow and look at
   its **Dataverse "Add/Update a row"** actions — the table name is the target.
3. `⋯` (More commands) → **Export** → **Get .zip package**. Accept defaults, download.
4. Drop the downloaded `.zip` (or, if you'd rather, the raw `definition.json` from
   inside it) into **this folder**: `apps/scheduling/flows/`.

Name them so I can tell them apart, e.g. `sync-bcjobs.zip`, `sync-bcplanninglines.zip`.

Once the files are here, tell me and I'll extract each `definition.json`, pinpoint
the exact action + field mapping causing each empty/wrong column, and hand back
corrected mappings for you to re-import.
