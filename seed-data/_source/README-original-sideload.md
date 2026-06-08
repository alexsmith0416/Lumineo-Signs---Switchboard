# Switchboard prototype side-load — 6/8/2026

Temporary data load to stand in for the broken Power Automate → Dataverse pull, until the real Business Central / Dataverse connection is wired up. Three files:

| File | What it is | Use it for |
|---|---|---|
| `production-jobs.json` | 728 jobs from the Airtable export, cleaned & typed | Seed for the production-schedule store (Sign Builder / Scheduling Hub) |
| `production-jobs.import.csv` | Same 728 jobs, flattened, no embedded newlines/URLs | Dataverse **Import from CSV** (manual, no flow) |
| `install-schedule-week.json` | WK + NEK install/service week of 6/8–6/13 | Scheduling Hub Weekly Calendar |

## What was cleaned
- Job # split into `jobNumber` (`J#####`) + `jobName`.
- Dates → ISO `YYYY-MM-DD`. `Scheduled Install` and `Date Invoiced` were empty in the export, so they're null everywhere — the calendar week comes from the install PDFs, not these columns.
- `$9,266.19` → `9266.19` (number); `#ERROR`, `NaN`, `?`, blanks → `null`.
- Department cells: `X` → `"done"`, `/` → `"in_progress"`.
- Giant Airtable attachment URLs dropped; `sketchFile` keeps just the filename.
- Non-breaking spaces normalized.
- Added `isActive` (Process not in Completed / Service Complete / Complete-need-paperwork → 641 active / 87 done) and `scheduledThisWeek` (true for the 35 jobs on this week's install sheets — every one resolved to a real production record).

## Loading it (two paths)

**A. Direct seed (fastest for prototype).** Drop the JSON into the repo and have the Zustand store hydrate from it when the Dataverse service is in mock/prototype mode — no flow, no import:
```ts
import productionJobs from "@/data/production-jobs.json";
import installWeek    from "@/data/install-schedule-week.json";
// in the service layer, behind a PROTOTYPE flag, return these instead of calling Dataverse
```

**B. Dataverse Import from CSV.** Power Apps → your production table → **Edit data in Excel / Import from CSV** → upload `production-jobs.import.csv` → map columns by hand once. This bypasses the flow entirely. Watch for: choice/optionset columns rejecting free-text (`currentStatus`, `process`) — set them to text for now or pre-create the options; and don't map into any BC-locked columns.

## Why the Power Automate pull probably fails
Most likely culprits in this specific export, in order:
1. **`#ERROR` cells** (the `Vinyl Due Date` formula column was entirely `#ERROR`) — Dataverse date/number columns reject them and fail the row/batch.
2. **Embedded newlines + commas** inside `Description` / `Job Notes` — a naive CSV parse in the flow splits one record across rows.
3. **Choice columns getting free text** — Airtable status strings that don't match a Dataverse optionset throw on insert.
4. **Date format** — `M/D/YYYY` vs the column's expected format.

The import CSV here already neutralizes 1 and 2. If you want, paste your flow's exact error and the target table's column logical names and I'll map the fields 1:1.

## install-schedule-week.json shape
`regions.WK` / `regions.NEK` → `crews[]` → `{ employee, crew, homeBase, region, entries[] }`, each entry `{ date, dayOfWeek, jobNumbers[], customer?, task?, note?, status?, placeholder? }`.
- WK is fully populated (11 crews incl. Salina/Dodge City; Ray = PTO all week).
- **NEK is mostly an unfilled template** — cells reading "NKC-018 / Install Sign Package / A lot of numbers" are marked `placeholder: true` so you can hide or grey them. Real NEK jobs this week: J36817 (Cap Fed directionals), J37549/J37550 (McDonald's World Cup, before 6/11), J36188 (O'Reilly Emporia), J37447, J35352.
- Join to production via `jobNumbers` ↔ `production-jobs.json[].jobNumber`.
