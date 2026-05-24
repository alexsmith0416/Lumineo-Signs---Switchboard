# Platform Foundation — Setup Guide

This is Phase 0-1 of the Lumineo Signs Power Apps build. **Nothing else can be built until this is complete.**

---

## Phase 0 Status

| Task | Status | Notes |
|---|---|---|
| Register `lum_` publisher | **Done** | |
| PAC CLI installed + authenticated | **Done** | |
| Photo storage decision | **Done** | Dataverse File columns (≤128 MB) |
| Create 5 Entra security groups | Deferred | Not needed yet — open access for all users |
| BC API admin access | Deferred | Airtable sync covers job data in the interim |

**Phase 0 is complete. Proceed to Phase 1 scripts.**

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
- `lum_photo` includes a Dataverse File column (`lum_photofile`, up to 128 MB)
- `lum_spotlight` includes a Dataverse File column (`lum_headshot`)
- Skips tables that already exist (safe to re-run)

**Expected output:** 19 lines — each either `CREATED` or `SKIPPED`

---

## Phase 1 Milestone Checklist

After running scripts, verify in the maker portal:

- [ ] `LumineoFoundation` solution visible (unmanaged)
- [ ] All 19 `lum_` tables visible in Dataverse table list
- [ ] `lum_photo` table has `lum_photofile` File column
- [ ] `lum_kpisnapshot` table exists
- [ ] `lum_pendingbcwrites` table exists

---

## Remaining Phase 1 Work (after scripts)

1. **Airtable mirror flow** — `AirtableMirror_Sync` Power Automate cloud flow, runs every 15 min, writes to `lum_job` (and related tables). **This is the primary job data source until BC API is available.**
2. **Nightly KPI flow** — recomputes `lum_kpisnapshot` at 05:30 daily
3. **Weather cache flow** — refreshes `lum_weathercache` every 15 min
4. **Canvas Component Library** — build 10 `lcl_` controls (see CLAUDE.md)
5. **Security roles** — basic Dataverse security roles (deferred until Entra groups configured)
6. **BC virtual tables** — deferred until BC API admin access granted
7. **ALM pipeline** — export managed solution from Dev, import to Test/Prod

---

## Deferred Tasks

These are parked until explicitly reopened — do not block Phase 1 on them:

- **Entra security groups** — 5 `Lumineo-*` groups + role-based app routing
- **BC API access** — virtual table config + automated write-back from `lum_pendingbcwrites`

---

## Environment Info

| Setting | Value |
|---|---|
| Solution name | `LumineoFoundation` |
| Publisher prefix | `lum_` |
| Publisher option prefix | `10000` |
| Solution type | Unmanaged in Dev, Managed in Test/Prod |
| Dataverse table count | 19 custom + 6 BC virtual (future) |
| Component library prefix | `lcl_` |
| Photo storage | Dataverse File columns (≤128 MB) |

---

## Troubleshooting

**"Publisher lum_ not found"** — Go to maker portal → Solutions → Publishers → New Publisher. Set prefix to `lum` exactly.

**"Access denied" on Web API** — Ensure your user has System Administrator role in the Dataverse environment.

**"Table already exists"** — Script is idempotent, this is expected. Check the log line says SKIPPED not ERROR.

**PAC CLI not found** — Install from: https://aka.ms/PowerAppsCLI
