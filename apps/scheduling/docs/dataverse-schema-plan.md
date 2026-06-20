# Dataverse schema plan — Project Scheduler (Phase 2)

Maps the engine's data model to deployed/needed Dataverse tables in
**Alex Smith's Environment** (`484cdd3c…` / `org8fa22efd`). Prefix `crfdf_`.

## 1. NEW table: `crfdf_productionscheduleline` (the granular line)

One row per scheduled task (per resource, per time slot) — the engine's
`ScheduleLine`. The deployed `lni_productionschedule` is job-level and cannot
hold this.

| Column (logical) | Type | Maps to ScheduleLine | Notes |
|---|---|---|---|
| `crfdf_name` | Text (primary) | — | display: `{jobNo} · {dept}` |
| `crfdf_jobno` | Text | jobNo | |
| `crfdf_customername` | Text | customerName | |
| `crfdf_planninglinedescription` | Multiline text | planningLineDescription | |
| `crfdf_startdatetime` | DateTime (user-local) | startDateTime | |
| `crfdf_enddatetime` | DateTime (user-local) | endDateTime | engine-computed |
| `crfdf_estimatedhours` | Decimal | estimatedHours | |
| `crfdf_overridehours` | Decimal (nullable) | overrideHours | |
| `crfdf_employee` | Lookup → `crfdf_employee` | employeeId | |
| `crfdf_department` | Lookup → `crfdf_department` | departmentId | |
| `crfdf_customerduedate` | DateTime (nullable) | customerDueDate | |
| `crfdf_islocked` | Yes/No | isLocked | custom cards lock |
| `crfdf_jobsequence` | Whole number | jobSequence | |
| `crfdf_preferredstart` | DateTime (nullable) | preferredStart | cascade pull-back floor |
| `crfdf_invoiceamount` | Currency (nullable) | invoiceAmount | install billing |
| `crfdf_crewpersons` | Whole number (nullable) | crewPersons | install |
| `crfdf_crewtrucks` | Whole number (nullable) | crewTrucks | install |
| `crfdf_crewcranes` | Whole number (nullable) | crewCranes | install |
| `crfdf_crewlifts` | Whole number (nullable) | crewLifts | install |
| `crfdf_crewbuckets` | Whole number (nullable) | crewBuckets | install |
| `crfdf_installzip` | Text (nullable) | installZip | weather |
| `crfdf_region` | Text (nullable) | region | WK / NEK |
| `crfdf_iscustom` | Yes/No | isCustom | PTO/holiday/etc. |
| `crfdf_customcolor` | Text (nullable) | customColor | |
| `crfdf_customtextcolor` | Text (nullable) | customTextColor | |

*Core (rows 1–14) are required for the engine; install/crew + custom (15–25)
can be a second wave if you want to ship the production calendar first.*

## 2. ADD columns to existing `crfdf_department`

Today it has only `crfdf_departmentid`, `crfdf_departmentname`.

| Column | Type | Maps to | Notes |
|---|---|---|---|
| `crfdf_floworder` | Whole number | Department.flowOrder | Routing 1 → Steel MFG 6 |
| `crfdf_color` | Text | Department.color | hex, e.g. `#BED7FF` |

## 3. Confirm/extend `crfdf_employee`

Engine `Employee` needs: name, departmentId, productivityRate,
standardHoursPerDay, maxOvertimePerDay, worksWeekends, hourlyRate?. Columns to
verify-or-add (exact existing set TBD when wired as a data source):

| Column | Type | Maps to |
|---|---|---|
| `crfdf_employeename` | Text | name |
| `crfdf_department` | Lookup → `crfdf_department` | departmentId |
| `crfdf_productivityrate` | Decimal | productivityRate |
| `crfdf_standardhoursperday` | Decimal | standardHoursPerDay |
| `crfdf_maxovertimeperday` | Decimal | maxOvertimePerDay |
| `crfdf_worksweekends` | Yes/No | worksWeekends |
| `crfdf_hourlyrate` | Currency | hourlyRate |

## 4. Later (per brief): keyword→dept map, work-hours, overtime, config

`crfdf_planninglinedepartmentmap`, `crfdf_employeeworkhours`,
`crfdf_overtimeoverride`, `crfdf_schedulerconfig`. Not needed for the first
production-calendar slice.
