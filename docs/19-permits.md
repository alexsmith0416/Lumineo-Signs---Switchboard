# 19 — Permit Tracking (Sales Hub)

## Why this lives in Sales Hub

Permitting starts as an **account-management activity**, not an operations one. The
rep is the person talking to the customer, chasing the landlord's sign-off, and
dealing with the jurisdiction — all of which happens *before* a job is released to
the shop. So the Permits button belongs on the Sales Hub job card, alongside the
other sales-side actions.

It does, however, **end** as an operations gate: fabrication and install can't
legally start until the required permits are approved. That split drives the core
design rule below.

## Principle

> **Button in Sales Hub. Data in shared Dataverse. Gate read by Scheduling Hub.**

The permit record must not live inside the Sales Hub app. It lives in `lum_` tables
so the Scheduling Hub can read a job's `permit-clear` status and refuse to schedule
fab/install on a job that isn't cleared. If the data were trapped in Sales Hub,
operations would be blind to it and the bottleneck would just move.

## Data model

Two new tables, both `lum_` prefix.

### `lum_permit`

The tracking record. One job can need several permits (sign + electrical +
variance + landlord approval), so this is one-to-many from `lum_job`.

| Column | Type | Notes |
|---|---|---|
| `lum_job` | Lookup → `lum_job` | Parent job |
| `lum_jurisdiction` | Text | City / county / AHJ |
| `lum_permittype` | Choice | Sign · Building · Electrical · Variance · Landlord/Owner Approval · Other |
| `lum_status` | Choice | Not Started · Gathering Docs · Submitted · In Review · Approved · Approved w/ Conditions · Rejected · Expired |
| `lum_submitteddate` | Date | Date sent to the jurisdiction |
| `lum_expecteddecision` | Date | Drives the follow-up badge |
| `lum_decisiondate` | Date | Actual approve/reject date |
| `lum_permitnumber` | Text | Issued permit / case number |
| `lum_fee` | Currency | Application fee |
| `lum_expiration` | Date | Permits expire — surfaced as a reminder |
| `lum_conditions` | Multiline text | Approval conditions / rejection reasons |
| `lum_owner` | Lookup → `lum_userprofile` | Responsible rep |
| `lum_isrequired` | Yes/No | Counts toward the job's permit-clear rollup (default Yes) |

### `lum_permitdoc`

Child of `lum_permit`. Holds metadata + a pointer to the file in SharePoint — the
file bytes never touch Dataverse.

| Column | Type | Notes |
|---|---|---|
| `lum_permit` | Lookup → `lum_permit` | Parent permit |
| `lum_title` | Text | Display name |
| `lum_category` | Choice | Submittal Package · Engineering/Structural (Sealed) · Landlord/Owner Approval · Approved Permit (Stamped) · Correction/Rejection Notice · Fee Receipt |
| `lum_sharepointurl` | URL | Link to the file in the job's `/Permits` subfolder |
| `lum_uploadedby` | Lookup → `lum_userprofile` | Who attached it |
| `lum_uploadeddate` | DateTime | Defaults to now |

## Documents & storage

**Documents go to SharePoint, not Dataverse File columns.** This reuses the
categorized-subfolder pattern already built for Time & Photo Capture. Permit
paperwork is the wrong fit for Dataverse File columns: engineering PDFs are large,
office staff need to open them outside the app, and Dataverse storage gets
expensive fast.

```
<JobFolder>/
└── Permits/
    ├── Submittal Package/
    ├── Engineering (Sealed)/
    ├── Landlord Approval/
    ├── Approved Permit/
    ├── Correction Notices/
    └── Fee Receipts/
```

Each upload writes the file to the matching subfolder and creates a `lum_permitdoc`
row pointing at it. The app shows a **categorized document strip**, not a flat file
pile — same UX move as the photo categories.

## Screens (mobile-first)

1. **Permits button** on the job card. Shows a **follow-up badge** = count of this
   job's permits past their `expecteddecision` date with status not yet Approved /
   Rejected.
2. **Permit list** (per job) — one row per permit: type, jurisdiction, status chip,
   expected-decision date. "+ Add permit."
3. **Permit detail** — status + dates + fields up top; categorized document strip
   below. "+ Add document" offers **Camera or Files**:
   - *Camera* — rep snaps the stamped permit on the wall / a correction letter; picks
     a category; it auto-files to the right SharePoint subfolder.
   - *Files* — office staff attach the big engineering / submittal PDFs from desktop.

## Reminders

Because Sales Hub is mobile, tie notifications to the dates that go stale silently:

- **Expected decision** passed and still pending → follow-up badge + push.
- **Expiration** approaching (e.g. 30 days) → reminder, since an expired permit can
  stall an install that was otherwise ready.

## Permit-clear rollup & operations handoff

The job carries a single derived flag operations actually consumes:

> **`permit-clear`** = every `lum_permit` where `lum_isrequired = Yes` has status
> Approved or Approved w/ Conditions.

- **Sales Hub** writes the permit records and documents.
- **Scheduling Hub** reads `permit-clear` and warns on (or blocks) scheduling fab /
  install for jobs that aren't cleared.
- This is a natural precondition for the **Order Released** / status flow still open
  in **ALE-92** — a job shouldn't release to the shop without being permit-clear.

The documents are the audit trail *behind* that flag.

## Build split

This is not a pure Sales Hub change — the tables come first.

| Owner | Work |
|---|---|
| **Platform Foundation** | `lum_permit` + `lum_permitdoc` tables; `permit-clear` rollup on `lum_job`; `/Permits` SharePoint subfolder provisioning; table-creation script |
| **Sales Hub** | Permits button + badge; permit list / detail screens; categorized document strip + Camera/Files capture → SharePoint; read-only permit-clear surfacing |

See the Linear projects **Platform Foundation** and **Sales Hub** for the issue breakdown.
