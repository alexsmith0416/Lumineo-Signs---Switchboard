# BCSync_JobSketches — the Jobs list's Sketch column

**What it does.** Finds each open job's sketch in its SharePoint folder and saves
a thumbnail of it, so the Jobs list can show the sketch at a glance (like the
Airtable attachment column). Clicking the thumbnail opens the file in SharePoint.

Source: `_gen_jobsketches_flow.py` → `BCSync_JobSketches-clientdata.json`;
packaged by `_build_jobsketches_solution.py` → `Downloads\BCJobSketches_1_0_0_10.zip`
(solution **BCJobSketches**; no secret). Table: `crfdf_jobsketch`
(`scripts/create-jobsketch-table.ps1`). App: `store/sketch-store.ts`, the
`SketchCell` in `components/jobs/JobsGrid.tsx`.

## Which file is "the sketch"

Sketches aren't named "sketch" — they're named after the job, e.g.
`J36572 Great Plains Manufacturing_East Shipping sign 4.pdf`,
`J39151-SECURITY 1ST TITLE(HUTCHINSON).pdf`, `J38740 YMCA_Wall Sign.pdf`. So, looking
in the job's folder (`crfdf_bcjobs.crfdf_sharepointurl`) **and its subfolders**:

1. the **newest PDF whose name starts with the job number**, else
2. the **newest image** (jpg, jpeg, png, gif, bmp, webp, heic, tif), else
3. nothing — the cell stays blank.

## How it works (nightly 4:30 AM Central, or Run)

1. **List_Jobs** — open `crfdf_bcjobs` with a SharePoint URL (or just `Only_Job`).
   **Jobs_In_Site** keeps the ones in the JobFiles site.
2. Per job (8 at a time; a job whose folder fails doesn't stop the rest):
   - **List_Files** — SharePoint "Send an HTTP request":
     `RenderListDataAsStream` on the library with `FolderServerRelativeUrl` = the
     job folder and `Scope="RecursiveAll"`, newest first.
   - **Pick_Sketch** — the rule above.
   - If the pick is new or changed (its id + modified date ≠ the saved
     `crfdf_fileversion`):
     - **Thumb_Info** — `_api/v2.0/drive/root:/<path in the library>:/thumbnails/0/<Thumb_Size>`
       returns `{url, width, height}` (SharePoint renders page 1 of a PDF). The
       `…/content` form answers **302** (a redirect to the image), which the
       SharePoint action counts as a failure — tested Sep 30 on J38740.
     - **Download_Thumbnail** — a plain HTTP GET of that short-lived, pre-signed `url`.
     - create / update the `crfdf_jobsketch` row: link, name, version, thumbnail
       as a `data:` URL. If the thumbnail fails the row is still saved (the cell
       shows "PDF" / "FILE" and still opens the file), with `|no-thumbnail` on its
       version so the next run tries again, and `crfdf_thumbnail` = `error: …`
       with each step's status and response — readable straight off the row.
   - No sketch any more → the job's row is removed.

Unchanged sketches cost no thumbnail call, so nightly runs after the first are quick.

## Parameters

| Parameter | Default |
|---|---|
| `Sp_Site` | `https://luminousneon.sharepoint.com/sites/JobFiles` |
| `Sp_Library_Path` | `/sites/JobFiles/Shared Documents` |
| `Thumb_Size` | `c320x240` (cropped/fit box SharePoint renders) |
| `Only_Job` | blank = every job; a job number = just that job (testing) |

## Import & test

1. Run `scripts/create-jobsketch-table.ps1` (creates `crfdf_jobsketch`).
2. Power Apps → Solutions → Import `BCJobSketches_1_0_0_10.zip`: bind **Microsoft
   Dataverse** to the existing connection and **SharePoint (Job Sketches)** to your
   SharePoint connection (create one if asked). It imports **Off**.
3. Test one job: edit the flow, set `Only_Job` to e.g. `J38740`, save, **Run**,
   then **Refresh** the Jobs list — the Sketch column shows its thumbnail.
4. Clear `Only_Job`, save, turn the flow **On**, and **Run** once to fill every job
   (the first run makes ~1,200 thumbnails; later runs only changed ones).
