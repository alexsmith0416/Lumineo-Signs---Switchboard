# Airtable → Dataverse Sync Flows

Two Power Automate flows. Build in the maker portal at make.powerautomate.com.

**Airtable base:** `appjphchC6hRzfkMi` (LNI Production Schedule)
**Environment:** `https://org8fa22efd.crm.dynamics.com`

---

## Flow 1 — AirtableMirror_Sync (lum_job)

**Purpose:** Keep `lum_job` current with basic job info for Switchboard, Sales Hub, and all other apps.
**Schedule:** Every 15 minutes
**Airtable tables:** LNI Production Schedule + Current Month Complete

### Steps

1. **Trigger:** Recurrence — every 15 minutes

2. **Initialize variable** `var_syncErrors` (Array)

3. **Airtable — List records** (connector: Airtable)
   - Base ID: `appjphchC6hRzfkMi`
   - Table: `LNI Production Schedule`

4. **Apply to each** record from step 3:

   a. **Dataverse — List rows** (filter):
      ```
      lum_job_name eq '@{items('Apply_to_each')?['fields']?['Job # / Name']}'
      ```

   b. **Condition:** `length(body('List_rows')?['value'])` is greater than `0`

   c. **If yes — Dataverse: Update row**
      - Table: `lum_jobs`
      - Row ID: `first(body('List_rows')?['value'])?['lum_jobid']`
      - Fields: (see mapping table below)

   d. **If no — Dataverse: Add a new row**
      - Table: `lum_jobs`
      - Fields: (see mapping table below)

5. Repeat steps 3–4 for `Current Month Complete` table (same mapping, same target table)

### Field Mapping — Airtable → lum_job

| Airtable field | Dataverse column | Notes |
|---|---|---|
| `Job # / Name` | `lum_job_name` | Primary name — upsert key |
| Record ID (from `@{items()?['id']}`) | `lum_airtablerecordid` | Internal Airtable ID for deduplication |
| `Current Status` | `lum_status` | |
| `Order Date (Received)` | `lum_startdate` | Convert to ISO date |
| `Scheduled Install` | `lum_duedate` | Convert to ISO date |
| `Job Notes` | `lum_notes` | |
| `Sales` (join array) | `lum_salesrep` | `join(items()?['fields']?['Sales'], ', ')` |
| `Location` | `lum_location` | |
| `"Active"` or `"Completed"` (literal) | `lum_recordtype` | Set based on which table |

> **Note:** `lum_airtablerecordid`, `lum_salesrep`, `lum_location`, `lum_recordtype` are new columns — run `04-add-job-columns.ps1` before this flow runs.

---

## Flow 2 — LNI_DetailSync (lum_productionschedule)

**Purpose:** Full production schedule data for the LNI Production Schedule Code App.
**Schedule:** Every 15 minutes (offset 7 min 30 sec from Flow 1 to spread API load)
**Airtable tables:** LNI Production Schedule (Active) + Current Month Complete (Completed)

### Steps

1. **Trigger:** Recurrence — every 15 minutes, start time offset by 7 min 30 sec

2. **Airtable — List records**
   - Base: `appjphchC6hRzfkMi`
   - Table: `LNI Production Schedule`

3. **Apply to each** record:

   a. **Dataverse — List rows** (filter):
      ```
      lum_ps_airtablerecordid eq '@{items('Apply_to_each')?['id']}'
      ```

   b. **Condition:** length > 0

   c. **Yes → Dataverse: Update row**
   d. **No → Dataverse: Add new row**

4. Repeat for `Current Month Complete` (set `lum_ps_recordtype = Completed`)

### Field Mapping — Airtable → lum_productionschedule

| Airtable field | Airtable type | Dataverse column | Transform |
|---|---|---|---|
| Record ID `@{items()?['id']}` | — | `lum_ps_airtablerecordid` | Upsert key |
| `"Active"` / `"Completed"` | — | `lum_ps_recordtype` | Set by source table |
| `Job # / Name` | multilineText | `lum_ps_name` | Primary name |
| `Sales` | multipleSelects | `lum_ps_sales` | `join(..., ', ')` |
| `Location` | text | `lum_ps_location` | |
| `Region` | singleSelect | `lum_ps_region` | |
| `Description` | multilineText | `lum_ps_description` | |
| `Priority` | multipleSelects | `lum_ps_priority` | `join(..., ', ')` |
| `Current Status` | singleSelect | `lum_ps_currentstatus` | |
| `Job Notes` | multilineText | `lum_ps_jobnotes` | |
| `Ready for Install` | singleSelect | `lum_ps_readyforinstall` | |
| `Powerlines` | singleSelect | `lum_ps_powerlines` | |
| `Locates` | singleSelect | `lum_ps_locates` | |
| `Date to Hold` | date | `lum_ps_datetohold` | `formatDateTime(..., 'yyyy-MM-dd')` |
| `Date off Hold` | date | `lum_ps_dateoffhold` | |
| `Order Date (Received)` | date | `lum_ps_orderdate` | |
| `Expeditor` | date | `lum_ps_expeditordate` | |
| `Mfg Target Modified` | date | `lum_ps_mfgtargetmodified` | |
| `Scheduled Install` | date | `lum_ps_scheduledinstall` | |
| `Date Installed` | date | `lum_ps_dateinstalled` | |
| `Date to Admin` | date | `lum_ps_datetoadmin` | |
| `Date Invoiced` | date | `lum_ps_dateinvoiced` | |
| `Admin Notes` | multilineText | `lum_ps_adminnotes` | |
| `Vendor` | multipleSelects | `lum_ps_vendor` | `join(..., ', ')` |
| `P.O. #` | text | `lum_ps_ponumber` | |
| `Vendor Ship Date` | date | `lum_ps_vendorshipdate` | |
| `2nd Vendor Ship Date` | date | `lum_ps_vendorshipdate2` | |
| `Vendor Status` | singleSelect | `lum_ps_vendorstatus` | |
| `Outsourced Arrival` | date | `lum_ps_outsourcedarrival` | |
| `Vinyl Ordered` | date | `lum_ps_vinylordered` | |
| `Vinyl - Complete` | date | `lum_ps_vinylcomplete` | |
| `Vinyl Prod. Start Date` | date | `lum_ps_vinylprodstartdate` | |
| `Vinyl Installer` | multipleSelects | `lum_ps_vinylinstaller` | `join(..., ', ')` |
| `Routing Ordered` | date | `lum_ps_routingordered` | |
| `Routing Complete` | date | `lum_ps_routingcomplete` | |
| `Routing Start Date` | date | `lum_ps_routingstartdate` | |
| `Routing Type` | singleSelect | `lum_ps_routingtype` | |
| `Routing Hrs` | number | `lum_ps_routinghrs` | |
| `Mfg Notes` | multilineText | `lum_ps_mfgnotes` | |
| `Mfg - Complete` | date | `lum_ps_mfgcomplete` | |
| `Graphics` | multipleSelects | `lum_ps_graphics` | `join(..., ', ')` |
| `Graphics Notes` | multilineText | `lum_ps_graphicsnotes` | |
| `Metal` | singleSelect | `lum_ps_metal` | |
| `Paint Prep` | number | `lum_ps_paintprep` | |
| `Paint` | number | `lum_ps_paint` | |
| `Assembly` | singleSelect | `lum_ps_assembly` | |
| `Plex/Application` | singleSelect | `lum_ps_plexapplication` | |
| `Vinyl Prod / Install/ Patterns` | singleSelect | `lum_ps_vinylprodpatterns` | |
| `Steel` | number | `lum_ps_steel` | |
| `Install` | number | `lum_ps_install` | |
| `Travel` | number | `lum_ps_travel` | |
| `Paint Prep/Paint` | singleSelect | `lum_ps_paintpreppaint` | |
| `Paint Prep/Paint 2` | number | `lum_ps_paintpreppaint2` | |
| `Material Cut` | singleSelect | `lum_ps_materialcut` | |
| `MFG Region` | singleSelect | `lum_ps_mfgregion` | |
| `Install Region` | singleSelect | `lum_ps_installregion` | |
| `MFG Rating` | multipleSelects | `lum_ps_mfgrating` | `join(..., ', ')` |
| `Install Area` | singleSelect | `lum_ps_installarea` | |
| `Value` | currency | `lum_ps_value` | |
| `Deposit` | singleSelect | `lum_ps_deposit` | |
| `Bill Day Job` | singleSelect | `lum_ps_billdayjob` | |
| `Process` | singleSelect | `lum_ps_process` | |
| `Sign Types` | singleSelect | `lum_ps_signtypes` | |
| `EMC Content` | multipleSelects | `lum_ps_emccontent` | `join(..., ', ')` |
| `Paint Color` | multipleSelects | `lum_ps_paintcolor` | `join(..., ', ')` |
| `Storage Location` | multipleSelects | `lum_ps_storagelocation` | `join(..., ', ')` |
| `Date Shipped` | date | `lum_ps_dateshipped` | |
| `Date Shipped 2` | date | `lum_ps_dateshipped2` | |
| `RED DATE` | date | `lum_ps_reddate` | |
| `TBD` | date | `lum_ps_tbd` | |
| `Routing - Due Date Modified` | date | `lum_ps_routingduedatemod` | |
| `Metal - Due Date Modified` | date | `lum_ps_metalduedatemod` | |
| `Paint Prep/Paint - Due Date Modified` | date | `lum_ps_ppduedatemod` | |
| `Material Cut - Due Date Modified` | date | `lum_ps_matcutduedatemod` | |
| `Assembly - Due Date Modified` | date | `lum_ps_assemblyduedatemod` | |
| `UL Sign` | checkbox | `lum_ps_ulsign` | |
| `Q.T.` | checkbox | `lum_ps_qt` | |
| `Aiden -or- Hunter` | checkbox | `lum_ps_aidenorHunter` | |
| `Aiden` | checkbox | `lum_ps_aiden` | |
| `Hunter` | checkbox | `lum_ps_hunter` | |

> **Formula fields to skip** (computed client-side): Mfg Target, Install Target, DIP, Hold DIP, Pre-ops DIP, Ops DIP, Admin DIP, Vinyl DIP, Routing DIP, Total Hrs Mfg, Total Hrs Install, all `*- Due Date` formula fields, current date, Adjusted DIP, Mfg. DIP, Mfg Final Date, Vinyl Due Date, all Final Due Date formulas.
>
> **Junk columns to skip:** All `Pasted field N` columns.

---

## Important: Date handling in Power Automate

Airtable returns dates as `"2026-06-15"` strings. Dataverse date-only columns accept ISO format directly. Use this expression for any date field:

```
if(empty(items('Apply_to_each')?['fields']?['Order Date (Received)']),
   null,
   items('Apply_to_each')?['fields']?['Order Date (Received)'])
```

---

## Airtable connector setup

Before building the flows, authenticate the Airtable connector in Power Automate:
1. make.powerautomate.com → Data → Connections → New connection → Airtable
2. Use your Airtable personal access token (read scope on `appjphchC6hRzfkMi`)
3. Name the connection: `Lumineo-Airtable`

---

## Error handling (add to both flows)

After the Apply to each block, add:
- **Scope** (run after failed): Send an email / post to Teams with `var_syncErrors` contents
- Set the scope's `Configure run after` to **has failed**
