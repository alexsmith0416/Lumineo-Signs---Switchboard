# Dataverse Table Setup Guide
## LNI Production Schedule — Power Apps Code App

This guide covers creating both required Dataverse tables from scratch in the Power Platform admin center.
All column logical names match the values hardcoded in `src/data/fieldDefs.ts` and `src/data/dataverse.ts`.

---

## Prerequisites

- Power Platform environment with a Dataverse database
- System Administrator or System Customizer role
- Access to **make.powerapps.com**

---

## Table 1: lni_productionschedule

### Step 1 — Create the Table

1. Go to **make.powerapps.com** → your environment
2. Left nav: **Tables** → **+ New table** → **Add columns and data**
3. Set:
   - **Display name**: `LNI Production Schedule`
   - **Plural display name**: `LNI Production Schedules`
   - **Name** (logical prefix): `lni_productionschedule`
   - **Primary column display name**: `Job Name` → logical name will be `lni_job_name`
   - **Primary column data type**: Multiple lines of text
4. Click **Create**

> The system auto-creates `lni_productionscheduleid` (GUID primary key) and `lni_job_name` (primary column).

---

### Step 2 — Add Columns

Go to the table → **Columns** → **+ New column** for each row below.

#### Legend
| Symbol | Dataverse Type |
|--------|---------------|
| TXT | Single line of text (max 500) |
| MEM | Multiple lines of text |
| DATE | Date Only |
| DEC | Decimal Number |
| CURR | Currency |
| BOOL | Yes/No (Two Options) |

---

#### Core Job Fields

| Display Name | Logical Name | Type | Required | Notes |
|---|---|---|---|---|
| Job Name | `lni_job_name` | MEM | Yes | **Primary column — already created** |
| Current Status | `lni_current_status` | TXT | No | Choice values managed in app code |
| Process | `lni_process` | TXT | No | |
| Priority | `lni_priority` | TXT | No | |
| Region | `lni_region` | TXT | No | |
| Sales | `lni_sales` | TXT | No | |
| Sign Types | `lni_sign_types` | TXT | No | |
| Location | `lni_location` | TXT | No | City, State |

#### Dates

| Display Name | Logical Name | Type | Required | Notes |
|---|---|---|---|---|
| Order Date | `lni_order_date` | DATE | No | |
| Expeditor | `lni_expeditor` | DATE | No | |
| Scheduled Install | `lni_scheduled_install` | DATE | No | |
| Mfg Target Modified | `lni_mfg_target_modified` | DATE | No | |
| Red Date | `lni_red_date` | DATE | No | Hard deadline |
| Vendor Ship Date | `lni_vendor_ship_date` | DATE | No | |

#### Financial

| Display Name | Logical Name | Type | Required | Notes |
|---|---|---|---|---|
| Value | `lni_value` | CURR | No | Job dollar value |

#### Install Readiness

| Display Name | Logical Name | Type | Required | Notes |
|---|---|---|---|---|
| Ready for Install | `lni_ready_for_install` | TXT | No | |
| Powerlines | `lni_powerlines` | TXT | No | |
| Locates | `lni_locates` | TXT | No | |
| MFG Region | `lni_mfg_region` | TXT | No | |
| Install Region | `lni_install_region` | TXT | No | |
| Install Area | `lni_install_area` | TXT | No | |

#### Vendor

| Display Name | Logical Name | Type | Required | Notes |
|---|---|---|---|---|
| Vendor | `lni_vendor` | TXT | No | |
| PO Number | `lni_po_number` | TXT | No | |
| Vendor Status | `lni_vendor_status` | TXT | No | |
| Graphics | `lni_graphics` | TXT | No | |
| Routing Type | `lni_routing_type` | TXT | No | |

#### MFG Stage Checkboxes (Text — '/' = done, 'X' = needed)

| Display Name | Logical Name | Type | Notes |
|---|---|---|---|
| Metal | `lni_metal` | TXT | Values: `/` or `X` |
| Assembly | `lni_assembly` | TXT | Values: `/` or `X` |
| Plex Application | `lni_plex_application` | TXT | Values: `/` or `X` |
| Paint Prep / Paint | `lni_paint_prep_paint` | TXT | Values: `/` or `X` |
| Material Cut | `lni_material_cut` | TXT | Values: `/` or `X` |

#### Hours

| Display Name | Logical Name | Type | Notes |
|---|---|---|---|
| Paint Prep Hrs | `lni_paint_prep_hrs` | DEC | |
| Paint Hrs | `lni_paint_hrs` | DEC | |
| Steel Hrs | `lni_steel_hrs` | DEC | |
| Install Hrs | `lni_install_hrs` | DEC | |
| Travel Hrs | `lni_travel_hrs` | DEC | |
| Routing Hrs | `lni_routing_hrs` | DEC | |

> **Do NOT create** `lni_dip`, `lni_total_hrs_mfg`, or `lni_total_hrs_install` — these are computed
> client-side by `src/hooks/calcFields.ts` and are never read from or written to Dataverse.

#### Compliance / Admin

| Display Name | Logical Name | Type | Notes |
|---|---|---|---|
| UL Sign | `lni_ul_sign` | BOOL | Default: No |
| Q.T. | `lni_qt` | BOOL | Default: No |
| Deposit | `lni_deposit` | TXT | Values: YES / NO / Exception / in process / N/A |
| Storage Location | `lni_storage_location` | TXT | |

#### Notes

| Display Name | Logical Name | Type | Notes |
|---|---|---|---|
| Job Notes | `lni_job_notes` | MEM | |
| Admin Notes | `lni_admin_notes` | MEM | |
| Mfg Notes | `lni_mfg_notes` | MEM | |

---

### Step 3 — Set Column Properties

For **all TXT columns** used as dropdowns, set:
- **Max length**: 500 (default is fine)
- **Required**: No
- **Searchable**: Yes

For **BOOL columns** (`lni_ul_sign`, `lni_qt`):
- **True label**: Yes
- **False label**: No
- **Default value**: No

For **CURR column** (`lni_value`):
- **Precision**: 2
- **Min/Max**: leave blank

For **DATE columns**:
- **Format**: Date Only (no time)
- **Behavior**: User Local

---

### Step 4 — Table Settings

Under **Table properties** → **Advanced options**:

| Setting | Value |
|---|---|
| Track changes | Yes (needed for Power Automate sync) |
| Enable for activities | No |
| Enable attachments | No |
| Audit changes | Yes (recommended) |
| Duplicate detection | No |

---

### Step 5 — Table Permissions (Power Pages / API)

In **Security** → **Table permissions**, add roles that need read/write access.
The app uses `webAPI` on the client — the calling user's security role must grant access.

Minimum required privileges:
- **Read** — all authenticated users who view the schedule
- **Write** — production managers, MFG leads
- **Create** — managers / sales
- **Delete** — admin only (the app UI does not expose delete)

---

## Table 2: lni_userviewpreferences

Stores per-user column visibility and order for each named view.

### Step 1 — Create the Table

1. **Tables** → **+ New table** → **Add columns and data**
2. Set:
   - **Display name**: `LNI User View Preferences`
   - **Name**: `lni_userviewpreferences`
   - **Primary column display name**: `Preference ID`
   - **Primary column data type**: Single line of text
3. Click **Create**

### Step 2 — Add Columns

| Display Name | Logical Name | Type | Notes |
|---|---|---|---|
| User ID | `lni_userid` | TXT | Power Apps `userSettings.userId` |
| View Name | `lni_viewname` | TXT | Matches VIEW_NAMES in viewConfigs.ts |
| Hidden Columns | `lni_hiddencolumns` | MEM | JSON array of hidden column keys |
| Column Order | `lni_columnorder` | MEM | JSON array of ordered column keys |

### Step 3 — Index for Performance

Create a **custom index** on `lni_userid` so the per-user filter query is fast:
- Go to table → **Keys** → **+ New key**
- Select `lni_userid`
- Name: `lni_userid_idx`

---

## Verification

After creating both tables, verify in `pac`:

```powershell
# Authenticate
& "C:\Users\Alex\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd" auth create --environment <your-env-url>

# List tables (should include both new tables)
& "C:\Users\Alex\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd" solution list
```

Or in **make.powerapps.com**: Tables → search `lni_` — both tables should appear.

---

## Data Migration from Airtable

If migrating existing records from Airtable:

1. Export Airtable base as CSV
2. Map Airtable field names to Dataverse logical names using the column table above
3. Use **Power Platform Dataflows** (make.powerapps.com → Dataflows → + New dataflow) to import:
   - Source: CSV / OData
   - Destination: `lni_productionschedule`
   - Map columns by logical name

Or use the **Excel Online connector** in Power Automate for smaller datasets.

---

## Power Automate — Business Central Sync (Future)

When the BC sync flow is implemented, it will:
1. Trigger on `lni_productionschedule` row **create/update** (Dataverse connector)
2. Map fields to BC Sales Order / Production Order entities
3. Write back the BC document number to a future `lni_bc_document_number` TXT column

Add that column only when the flow is ready — do not create it now.
