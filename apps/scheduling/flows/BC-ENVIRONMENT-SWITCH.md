# Switching the BC integration between UAT and Production

The scheduler never calls Business Central directly — Power Automate flows read
BC and write to Dataverse staging tables, and the app reads Dataverse. So the
"which BC environment" choice lives **in the flows**, on the BC connector's
`GetItemsV3` action parameters.

## The switch points

| Parameter | UAT (now) | Production (later) |
|---|---|---|
| `bcenvironment` | `UAT` | `PRODUCTION` |
| `company` (GUID) | `4738bfb5-a06d-ec11-bf27-000d3a132a9e` | confirm — may match UAT |
| `dataset` | `infotechConsultingGroup/sign365/v1.0` | same (once sign365 is in prod) |

## Release-date flow (new) — already parameterized

`BCSync_JobReleaseDates` reads these from three flow parameters — **`Bc_Environment`,
`Bc_CompanyId`, `Bc_Dataset`**. To cut it over to production:

1. Power Automate → the flow → **Edit**.
2. Expand **Parameters** and change `Bc_Environment` to `PRODUCTION` (and
   `Bc_CompanyId` if the prod company GUID differs).
3. **Save**. Done — no action internals to touch.

> Note: it reads the **sign365** dataset because that's the only one exposing
> `icgSgpOrderReleasedDate`. The existing `BCSync_Jobs` still reads
> `microsoft/analytics/v1.0` from `PRODUCTION` — leave it as-is during UAT
> testing so production job data isn't disturbed.

## The other BCSync flows (Jobs/Customers/SalesLines/…) — not yet parameterized

They currently hardcode `bcenvironment: PRODUCTION` + the company GUID inside
each `GetItemsV3` action. When you do the full prod cutover, the clean, one-place
approach is **Dataverse environment variables**:

1. In the solution, add environment variables e.g. `lum_bc_environment`,
   `lum_bc_companyid`, `lum_bc_dataset`.
2. In each flow, replace the literal `bcenvironment` / `company` / `dataset`
   values with references to those variables.
3. Switching environments is then a single edit: **Solutions → the environment
   variable → set current value** — every flow follows, no flow edits.

Until then, the release-date flow's three parameters are the quick switch, and
the others are a find-and-replace of `PRODUCTION`/company id inside each flow.

## Checklist when production sign365 is ready

- [ ] Confirm the prod **company GUID** (compare to the UAT one above).
- [ ] Flip `BCSync_JobReleaseDates` `Bc_Environment` → `PRODUCTION` (+ company).
- [ ] Run it once; verify `crfdf_bcjobs.crfdf_releasedate` populates for open jobs.
- [ ] (Optional) migrate the other BCSync flows to env variables per above.
