# Lumineo Switchboard — Dataverse Table Mapping (master reference)

> Authoritative crosswalk of **every sub-app → the Dataverse table(s) it reads/writes → exact column logical names.**
> Use this when wiring each prototype to live Dataverse. Last compiled: 2026-06-08.

There are **two prefixes live in this repo** and that is intentional:

| Prefix | Where it comes from | Use it for |
|---|---|---|
| `lni_` | LNI Production Schedule Code App — `lni-production-schedule/src/data/fieldDefs.ts` (the app's single source of truth) and the solution export in `.dataverse-solution/` | The **production-schedule job table that is actually deployed and read today**. Canonical home for the 728 jobs. |
| `lum_` | `platform-foundation/scripts/02/03/04-*.ps1` per the Dev Bible | The **shared platform tables** (user profile, KPIs, crew assignments, announcements, etc.) consumed by Switchboard + the canvas apps. |

> **Decision (2026-06-08):** the 728-job production export maps to **`lni_productionschedule`** because that is the table the deployed LNI app already reads — zero code change to light it up. The parallel `lum_productionschedule` script (68 `lum_ps_*` columns) and the lighter `lum_job` table remain in the repo as the future "bring it under the `lum_` umbrella" path; a migration crosswalk is at the bottom of this file.

---

## 1. App → Table matrix

| Sub-app | Type | Primary table(s) | Supporting tables | Status |
|---|---|---|---|---|
| **Switchboard** (shell) | Canvas | `lum_userprofile` | `lum_announcement`, `lum_event`, `lum_kpisnapshot`, `lum_spotlight`, `lum_suggestion`, `lum_systemconfig` | Not started |
| **LNI Production Schedule** | Code App | **`lni_productionschedule`** | `lni_userviewpreferences` | Deployed — seed ready |
| **Sign Builder Pro** | Canvas | `lum_signspec` | `lni_productionschedule` (job lookup), `lum_job` | QA / deploy |
| **Sales Hub** | Canvas | `lum_opportunity` | `lum_job`, `bc_Customer` (future) | Not started |
| **Time & Photo Capture** | Canvas | `lum_timeentry`, `lum_photo` | `lum_job`, `lum_task`, `lum_crewassignment` | Not started |
| **Lumineo Scheduling Hub** | Code App | `lum_crewassignment` | `lni_productionschedule` (job join), `lum_weathercache` | Prototype |
| **Production Scheduling** (engine) | Code App | `lum_crewassignment` *(planning lines — table TBD)* | `lni_productionschedule` | M1 scaffold |
| **Switchboard prototype** (splash) | React | `lum_kpisnapshot`, `lum_announcement`, `lum_spotlight`, `lum_safetymetric` | `lum_userprofile` | Dashboard only |

---

## 2. Production jobs → `lni_productionschedule`

Source: `seed-data/_source/production-jobs.json` (728 records, camelCase) →
app key in `LniRecord` → Dataverse column (`dvColumn` in `fieldDefs.ts`).

| Export field (JSON / CSV) | LniRecord key | Dataverse column | Type | Notes |
|---|---|---|---|---|
| `jobNumber` + `jobName` | `job` | `lni_name` | text | Combined as `J##### / Name` (primary name field) |
| `currentStatus` | `status` | `lni_current_status` | choice | 29 options in `fieldDefs.ts` |
| `process` | `process` | `lni_process` | choice | 16 options |
| `priority` | `priority` | `lni_priority` | choice | |
| `region` | `region` | `lni_region` | choice | WK / NEK / DODGE CITY |
| `sales` | `sales` | `lni_sales` | choice | rep initials |
| `location` | `location` | `lni_location` | text | |
| `description` | `description` | `lni_description` | multiline | newlines collapsed for CSV |
| `jobNotes` | `notes` | `lni_job_notes` | multiline | |
| `readyForInstall` | `readyInstall` | `lni_ready_for_install` | choice | |
| `orderDate` | `orderDate` | `lni_order_date` | date | ISO `YYYY-MM-DD` |
| `mfgTargetModified` → fallback `mfgTarget` | `mfgTargetMod` | `lni_mfg_target_modified` | date | see unmapped note for `mfgTarget` |
| `scheduledInstall` | `scheduledInstall` | `lni_scheduled_install` | date | null in export (comes from install PDFs) |
| `dateInstalled` | `dateInstalled` | `lni_date_installed` | date | |
| `dateToAdmin` | `dateToAdmin` | `lni_date_to_admin` | date | |
| `vendor` | `vendor` | `lni_vendor` | choice | |
| `poNumber` | `po` | `lni_po_number` | text | |
| `vendorStatus` | `vendorStatus` | `lni_vendor_status` | choice | |
| `mfgRegion` | `mfgRegion` | `lni_mfg_region` | choice | |
| `installRegion` | `installRegion` | `lni_install_region` | choice | |
| `value` | `value` | `lni_value` | currency | `$9,266.19` → `9266.19` |
| `ulSign` | `ulSign` | `lni_ul_sign` | bool | CSV emits `Yes`/`No` |
| `departments.graphics` | `graphics` | `lni_graphics` | choice | |
| `departments.routingType` | `routingType` | `lni_routing_type` | choice | |
| `departments.metal` | `metal` | `lni_metal` | choice | `done`→`X`, `in_progress`→`/` |
| `departments.assembly` | `assembly` | `lni_assembly` | choice | same glyph mapping |
| `departments.plexApplication` | `plex` | `lni_plex_application` | choice | same glyph mapping |
| `departments.vinyl` | `vinylProd` | `lni_vinyl_prod` | choice | same glyph mapping |
| `totalHrsMfg` | `totalMfg` | `lni_total_hrs_mfg` | readonly | calc in app; column exists for import |
| `totalHrsInstall` | `totalInstall` | `lni_total_hrs_install` | readonly | calc in app |
| `dip` | `dip` | `lni_dip` | readonly | recomputed client-side |

### Unmapped export fields (no column on the deployed table)
These carry through to the JSON seed where a key exists, but are **left out of the import CSV** because `lni_productionschedule` has no column for them. Add columns first if you want them in Dataverse:

| Export field | Why unmapped | If you want it |
|---|---|---|
| `mfgTarget` (original target) | table only has `lni_mfg_target_modified` | add `lni_mfg_target` (date) |
| `installTarget` | no target-install column | add `lni_install_target` (date) |
| `vinylDueDate` | was the all-`#ERROR` formula column | add `lni_vinyl_due_date` (date) after fixing the formula |
| `sketchFile` | attachment filename only | add `lni_sketch_file` (text) or use a File column |
| `isActive` / `scheduledThisWeek` | derived flags (from status / install sheet) | compute in a view or add `lni_is_active` (bool) |

---

## 3. Install week → `lum_crewassignment`

Source: `seed-data/_source/install-schedule-week.json` (WK + NEK, week of 6/8–6/13).
One Dataverse row per **crew-member × job-day**.

| Source | Dataverse column | Notes |
|---|---|---|
| `jobNumbers[]` + `customer` + `task` | `lum_crewassignment_name` | composed label, ≤200 chars; placeholder NEK cells prefixed `[TEMPLATE]` |
| `entries[].date` | `lum_assigneddate` | ISO date |
| `crews[].employee` | `lum_crewmember` | |
| `crews[].crew` | `lum_truckid` | crew/truck code (e.g. `F96`, `60`, `F-38`) |
| region code (`WK`/`NEK`) | `lum_role` | `WK install` / `NEK install` |

Join key: `entries[].jobNumbers[]` ↔ `lni_productionschedule.lni_name` (the `J#####` prefix).
The enriched `scheduling-hub/seed-install-week.json` resolves each `jobNumbers[]` against the 728 production records (57 matched this week) and adds a `jobs[]` array with `jobName`/`currentStatus`/`installRegion`/`value`.

---

## 4. Full `lum_` platform table catalog

Created by `platform-foundation/scripts/02-create-tables.ps1` (+ 03/04). Every table has a
`<logical>_name` primary text column. Prefix `lum_`, option-value prefix `10000`, solution `LumineoFoundation`.

| Table | Key columns (logical names) |
|---|---|
| `lum_userprofile` | `lum_azureadobjectid`, `lum_email`, `lum_role`, `lum_department`, `lum_jobtitle`, `lum_isactive` |
| `lum_job` | `lum_jobnumber`, `lum_customername`, `lum_status`, `lum_startdate`, `lum_duedate`, `lum_bcsalesorderid`, `lum_notes`, `lum_airtablerecordid`, `lum_salesrep`, `lum_location`, `lum_recordtype` |
| `lum_task` | `lum_description`, `lum_status`, `lum_assignedto`, `lum_duedate`, `lum_iscomplete` |
| `lum_timeentry` | `lum_clockin`, `lum_clockout`, `lum_hoursworked`, `lum_crewmember`, `lum_notes` |
| `lum_photo` | `lum_photofile` (File ≤128MB), `lum_caption`, `lum_jobreference`, `lum_takenby`, `lum_takendatetime`, `lum_thumbnailurl` |
| `lum_signspec` | `lum_signtype`, `lum_material`, `lum_width`, `lum_height`, `lum_finishcolor`, `lum_vinylcolor`, `lum_specjson`, `lum_status` |
| `lum_opportunity` | `lum_customername`, `lum_estimatedvalue`, `lum_stage`, `lum_ownerusername`, `lum_expectedclosedate`, `lum_notes` |
| `lum_announcement` | `lum_body`, `lum_priority`, `lum_startdate`, `lum_enddate`, `lum_isactive` |
| `lum_event` | `lum_description`, `lum_startdatetime`, `lum_enddatetime`, `lum_location`, `lum_audienceroles` |
| `lum_safetymetric` | `lum_date`, `lum_dayssinceinc`, `lum_nearmisstotal`, `lum_notes` |
| `lum_safetyincident` | `lum_incidentdatetime`, `lum_reportedby`, `lum_severity`, `lum_description`, `lum_isresolved` |
| `lum_kpisnapshot` | `lum_snapshotdate`, `lum_revenuemtd`, `lum_jobsopen`, `lum_jobsclosed`, `lum_crewheadcount`, `lum_dayssinceinc`, `lum_weathersummary` |
| `lum_crewassignment` | `lum_assigneddate`, `lum_crewmember`, `lum_truckid`, `lum_role` |
| `lum_weathercache` | `lum_location`, `lum_lastupdated`, `lum_conditiontext`, `lum_tempc`, `lum_tempf`, `lum_humidity`, `lum_iconurl` |
| `lum_systemconfig` | `lum_key`, `lum_value`, `lum_description` |
| `lum_pendingbcwrites` | `lum_entitytype`, `lum_operation`, `lum_payload`, `lum_status`, `lum_queueddate`, `lum_processeddate`, `lum_errormessage`, `lum_retrycount` |
| `lum_synclog` | `lum_synctype`, `lum_syncstart`, `lum_syncend`, `lum_recordssynced`, `lum_errorcount`, `lum_status`, `lum_details` |
| `lum_spotlight` | `lum_employeename`, `lum_jobtitle`, `lum_bio`, `lum_headshot` (File), `lum_featuredfrom`, `lum_featuredto`, `lum_isactive` |
| `lum_suggestion` | `lum_body`, `lum_submittedby`, `lum_submitteddate`, `lum_status`, `lum_isanonymous`, `lum_adminresponse` |
| `lum_productionschedule` *(parallel, 68 cols)* | `lum_ps_*` — see §5 migration crosswalk |
| `lum_userviewpreferences` | `lum_uvp_userid`, `lum_uvp_viewname`, `lum_uvp_hiddenfields`, `lum_uvp_fieldorder` |

---

## 5. `lni_` → `lum_ps_` migration crosswalk (future)

If/when the production table is brought under the `lum_` umbrella (Dev Bible rule), re-point
`fieldDefs.ts` `dvColumn` values using this map. Until then, **do not** run a migration — the app reads `lni_`.

| `lni_` (deployed) | `lum_ps_` (platform script) |
|---|---|
| `lni_name` | `lum_productionschedule_name` |
| `lni_current_status` | `lum_ps_currentstatus` |
| `lni_process` | `lum_ps_process` |
| `lni_priority` | `lum_ps_priority` |
| `lni_region` | `lum_ps_region` |
| `lni_sales` | `lum_ps_sales` |
| `lni_location` | `lum_ps_location` |
| `lni_description` | `lum_ps_description` |
| `lni_job_notes` | `lum_ps_jobnotes` |
| `lni_ready_for_install` | `lum_ps_readyforinstall` |
| `lni_order_date` | `lum_ps_orderdate` |
| `lni_scheduled_install` | `lum_ps_scheduledinstall` |
| `lni_date_installed` | `lum_ps_dateinstalled` |
| `lni_date_to_admin` | `lum_ps_datetoadmin` |
| `lni_vendor` | `lum_ps_vendor` |
| `lni_po_number` | `lum_ps_ponumber` |
| `lni_vendor_status` | `lum_ps_vendorstatus` |
| `lni_mfg_region` | `lum_ps_mfgregion` |
| `lni_install_region` | `lum_ps_installregion` |
| `lni_value` | `lum_ps_value` |
| `lni_ul_sign` | `lum_ps_ulsign` |
| `lni_graphics` | `lum_ps_graphics` |
| `lni_routing_type` | `lum_ps_routingtype` |
| `lni_metal` | `lum_ps_metal` |
| `lni_assembly` | `lum_ps_assembly` |
| `lni_plex_application` | `lum_ps_plexapplication` |
| `lni_vinyl_prod` | `lum_ps_vinylprodpatterns` |

(`lum_ps_*` also defines ~40 extra stage/hours/date columns the deployed `lni_` table doesn't yet have — `lum_ps_routinghrs`, `lum_ps_paintprep`, `lum_ps_steel`, `lum_ps_reddate`, etc. See `03-create-production-table.ps1`.)
