# Platform Foundation — Setup Guide

This is Phase 0-1 of the Lumineo Signs Power Apps build. **Nothing else can be built until this is complete.**

---

## Prerequisites Checklist (Manual — Alex must complete)

### Phase 0: Environment Prep (do these before running any scripts)

- [ ] **Register `lum_` publisher** in Power Apps maker portal
  - Display name: `Lumineo`
  - Prefix: `lum`
  - Choice value prefix: `10000`
  - ⚠️ This prefix is PERMANENT. Verify it is exactly `lum` before saving.

- [ ] **Create 5 Entra security groups** (exact names — do not abbreviate):
  - `Lumineo-Operations`
  - `Lumineo-Sales`
  - `Lumineo-Employees-Production`
  - `Lumineo-Employees-Installation`
  - `Lumineo-Employees-Shipping`

- [ ] **Add group members** to each Entra group as appropriate

- [ ] **Confirm photo storage decision**:
  - Option A: Dataverse File columns (≤128 MB per photo, simpler)
  - Option B: SharePoint document library (full-res, more setup)
  - This affects how `lum_Photo` table is configured

- [ ] **Request BC API admin access** (for write-back; reads via virtual tables work now)

- [ ] **Verify PAC CLI is installed and authenticated:**
  ```powershell
  pac auth list
  pac org who
  ```

---

## Phase 1: Run Setup Scripts

Run these scripts in order from this directory. Each is idempotent — safe to re-run.

### Step 1: Verify publisher and create solution

```powershell
cd platform-foundation\scripts
.\01-setup.ps1 -EnvironmentUrl "https://<your-env>.crm.dynamics.com"
```

What it does:
- Confirms PAC CLI is installed
- Authenticates to your environment
- Verifies `lum_` publisher exists (errors with instructions if not)
- Creates `LumineoFoundation` solution if it doesn't exist

### Step 2: Create all 19 Dataverse tables

```powershell
.\02-create-tables.ps1 -EnvironmentUrl "https://<your-env>.crm.dynamics.com"
```

What it does:
- Creates all 19 `lum_` tables via Dataverse Web API
- Skips tables that already exist (idempotent)
- Logs results to console

**Expected output:** 19 tables created (or skipped if re-run)

---

## Phase 1 Milestone Checklist

After running scripts, verify:

- [ ] `LumineoFoundation` solution visible in maker portal (unmanaged)
- [ ] All 19 `lum_` tables visible in Dataverse table list
- [ ] `lum_userprofile` table has AzureADObjectId column
- [ ] `lum_kpisnapshot` table exists (for nightly KPI recompute)
- [ ] `lum_pendingbcwrites` table exists (for BC write queue)

---

## Remaining Phase 1 Work (after scripts)

1. **Security roles** — Create and assign Dataverse security roles for each Entra group
2. **BC virtual tables** — Install Business Central virtual table solution, configure connectors
3. **AirtableMirror_Sync flow** — Power Automate cloud flow, runs every 15 min
4. **Canvas Component Library** — Build 10 `lcl_` controls (see CLAUDE.md for list)
5. **ALM pipeline** — Export managed solution from Dev, import to Test/Prod

---

## Environment Info

| Setting | Value |
|---|---|
| Solution name | `LumineoFoundation` |
| Publisher prefix | `lum_` |
| Publisher option prefix | `10000` |
| Solution type | Unmanaged in Dev, Managed in Test/Prod |
| Dataverse table count | 19 custom + 6 BC virtual |
| Component library prefix | `lcl_` |

---

## Troubleshooting

**"Publisher lum_ not found"** — Go to maker portal → Solutions → Publishers → New Publisher. Set prefix to `lum` exactly.

**"Access denied" on Web API** — Ensure your user has System Administrator role in the Dataverse environment.

**"Table already exists"** — Script is idempotent, this is expected. Check the log line says SKIPPED not ERROR.

**PAC CLI not found** — Install from: https://aka.ms/PowerAppsCLI
