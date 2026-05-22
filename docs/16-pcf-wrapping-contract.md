# 16 — PCF Wrapping Contract (Existing React Apps)

## Purpose

Three of the five sub-apps already have working React codebases (Weekly Scheduler, Sign Builder Pro, Sales Hub). The architecture (doc 01) keeps them by wrapping each as a **PCF control** — Microsoft's Power Apps Component Framework — embedded inside its host Canvas or Model-Driven app.

This doc is the **contract** each PCF must satisfy so the host app, the launch contract (doc 15), and the Dataverse schema (doc 04) all line up cleanly. It also gives each React-app owner a concrete migration checklist.

## Why PCF (vs. canvas rebuild or iframe)

| Option | Verdict |
|---|---|
| **Rebuild in canvas Power Fx** | Discards working UI logic (drag-and-drop calendar, visual spec builder). Months of unpaid rework. ❌ |
| **Iframe the existing React app** | Survives, but loses identity SSO, Dataverse access via `context.webAPI`, theming, mobile player, and managed-solution lifecycle. ❌ |
| **PCF (this doc)** | Native Power Apps component, full TypeScript, calls Dataverse Web API, ships in a managed solution, runs in canvas + model-driven + mobile player. ✅ |

PCF is the only option Microsoft endorses for "hosting React inside Power Apps". It's also the only one that preserves single-sign-on and survives an ALM pipeline.

## What a PCF is — five-bullet primer

1. A TypeScript component declared in a **`ControlManifest.Input.xml`** with typed inputs (properties), typed outputs (properties + events), and Dataverse permissions it needs.
2. Implements four lifecycle methods: `init`, `updateView`, `getOutputs`, `destroy`. (PCF v2 / "virtual control" supports React natively — that's the mode we use.)
3. Receives a `context` object exposing `parameters` (typed inputs), `webAPI` (Dataverse CRUD), `userSettings`, `device`, `mode` (read-only? offline?), and `factory` (popups).
4. Builds to a `bundle.js` + assets, packaged into a managed solution via `pac` CLI, deployed alongside the host canvas/MDA app.
5. Inputs flow in from the host app (canvas formula or model-driven form field binding). Outputs flow back via `notifyOutputChanged()` — the host app reads them as record properties.

> Reference: [Microsoft Learn — PCF virtual controls](https://learn.microsoft.com/power-apps/developer/component-framework/react-controls-platform-libraries). PCF v2 / React virtual controls are GA — use that mode, not legacy "standard" PCF.

## Universal input contract

Every Lumineo PCF declares **at minimum** these inputs in its manifest. This is the bridge from the launch contract (doc 15) into the React code.

```xml
<!-- ControlManifest.Input.xml — shared header -->
<property name="userEmail"   of-type="SingleLine.Text" usage="input" required="true" />
<property name="role"        of-type="SingleLine.Text" usage="input" required="true" />
<property name="action"      of-type="SingleLine.Text" usage="input" required="false" />
<property name="contextJson" of-type="Multiple"        usage="input" required="false" />
<property name="returnTo"    of-type="SingleLine.Text" usage="input" required="false" />

<!-- Universal output: surfaces a request to navigate back to Switchboard -->
<property name="exitRequested" of-type="TwoOptions" usage="output" />
<property name="exitTarget"    of-type="SingleLine.Text" usage="output" />
```

`contextJson` carries the **entire `context` object** from doc 15 (after the host parsed `Param("context")` or read it from `lum_LaunchContext`). The PCF re-parses it on every `updateView`.

PCF-specific inputs (e.g. `specId`, `weekStart`, `deptFilter`) are *also* declared in the manifest as named properties — the canvas host binds them from `gblCtx.specId`, `gblCtx.weekStart`, etc. — but `contextJson` is the durable, version-tolerant pipe for everything else.

## Universal lifecycle skeleton

```tsx
// index.ts — every PCF starts here
import * as React from "react";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import App from "./App";

interface LumContext {
  schemaVersion: number;
  action?: string;
  impersonatedBy?: string;
  [key: string]: unknown;
}

export class WeeklyScheduler
  implements ComponentFramework.ReactControl<IInputs, IOutputs>
{
  private notify!: () => void;
  private exitRequested = false;
  private exitTarget = "";

  public init(
    _context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
  ): void {
    this.notify = notifyOutputChanged;
  }

  public updateView(
    context: ComponentFramework.Context<IInputs>,
  ): React.ReactElement {
    const ctx: LumContext = safeParseJson(
      context.parameters.contextJson.raw,
      { schemaVersion: 1 },
    );

    return React.createElement(App, {
      userEmail: context.parameters.userEmail.raw ?? "",
      role: (context.parameters.role.raw ?? "Operations") as Role,
      action: context.parameters.action.raw ?? undefined,
      ctx,
      webApi: context.webAPI,
      mode: context.mode,
      onExit: (target?: string) => {
        this.exitRequested = true;
        this.exitTarget = target ?? "switchboard://home";
        this.notify();
      },
    });
  }

  public getOutputs(): IOutputs {
    const out = {
      exitRequested: this.exitRequested,
      exitTarget: this.exitTarget,
    };
    this.exitRequested = false;     // edge-trigger; resets after host reads
    return out;
  }

  public destroy(): void {}
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
```

The React `App` component receives `webApi`, `userEmail`, `role`, `ctx`, `action`, `mode`, and an `onExit` callback. Everything else the React tree needs flows from there.

## Dataverse access from inside a PCF

PCFs talk to Dataverse via `context.webAPI`. Never call `fetch()` against the Dataverse REST endpoint directly — the PCF runtime injects auth and handles 401 refresh through `webAPI`.

```ts
// React component, typical read
const job = await webApi.retrieveRecord("lum_job", jobId, "?$select=lum_name,lum_status,lum_bcsalesorderid");

// Typical write — note the underscore convention for lookup binds
await webApi.updateRecord("lum_task", taskId, {
  lum_status: "Done",
  "lum_assignedto@odata.bind": `/systemusers(${assigneeId})`,
});

// Queueing a BC write (doc 14) — same pattern, no special API
await webApi.createRecord("lum_pendingbcwrites", {
  lum_entitytype: "Job",
  lum_entityid: jobId,
  lum_operation: "MarkOrderShipped",
  lum_payload: JSON.stringify(payload),
  lum_status: "Pending",
});
```

PCF manifests must declare every entity they touch in `<data-set>` or under `<resources>` for fetchXml grants. The pac CLI surfaces missing privileges at install time.

### Offline note

Canvas hosts on the mobile player support offline data with `LoadData`/`SaveData`, but **PCF controls do not get an offline `webAPI`**. Time & Photo Capture stays out of PCF for this reason (doc 07). Sign Builder Pro and Weekly Scheduler accept that their PCFs require a live connection; they show an offline banner when `context.mode.isControlDisabled === true` or `context.client.isOffline === true`.

## Per-PCF input/output catalog

### `WeeklyScheduler` (inside Weekly Scheduler canvas app)

| Property | Direction | Type | Purpose |
|---|---|---|---|
| Universal 5 + `exitRequested`/`exitTarget` | — | — | Per universal contract above |
| `weekStart` | input | DateAndTime | ISO date of Monday to scroll to |
| `deptFilter` | input | SingleLine.Text | `Production`\|`Installation`\|`Shipping`\|`All` |
| `taskClicked` | output | SingleLine.Text | `taskId` selected by user |
| `taskAssigned` | output | SingleLine.Text | JSON `{taskId, userEmail}` after drag-assign |

Cold-boot actions it honors (from `ctx.action`): `openWeek`, `openTask`, `assignTask`.

Internal Dataverse touch: `lum_task` (read + update — drag persists), `lum_userprofile` (read, for row labels), `lum_crewassignment` (read, for badges on cards).

### `SignBuilder` (inside Sign Builder Pro canvas app + Sales Hub quote-line form)

| Property | Direction | Type | Purpose |
|---|---|---|---|
| Universal 5 + exit pair | — | — | Per universal contract |
| `specId` | input | SingleLine.Text | GUID — edit mode if set |
| `opportunityId` | input | SingleLine.Text | GUID — new-from-opp mode |
| `jobId` | input | SingleLine.Text | GUID — new-from-job mode |
| `mode` | input | SingleLine.Text | `view`\|`edit`\|`approve` |
| `specSaved` | output | SingleLine.Text | GUID of saved SignSpec |
| `specSubmitted` | output | SingleLine.Text | GUID of spec submitted for approval |
| `approvalDecision` | output | SingleLine.Text | JSON `{specId, decision: "approved"\|"rejected", note}` |

Cold-boot actions: `openSpec`, `newSpec`, `approveQueue`.

Internal Dataverse touch: `lum_signspec` (CRUD), `lum_photo` (create — preview thumbnails, art file uploads), `bc_item` virtual (read — material BOM lookups).

### `CustomerDashboard` (inside Sales Hub model-driven app, on Account form)

| Property | Direction | Type | Purpose |
|---|---|---|---|
| Universal 5 + exit pair | — | — | Per universal contract |
| `customerId` | input (bound) | LookupSimple | The Account this form is showing |
| `salesHistoryRange` | input | Whole.None | Days of BC history to load (default 90) |
| `openOpportunity` | output | SingleLine.Text | GUID — when user clicks an opp in the timeline |
| `openSignSpec` | output | SingleLine.Text | GUID — when user clicks a spec preview |

In a model-driven host, `customerId` is bound to the form record automatically — the host wires `_primaryEntityId` into the PCF without any explicit canvas formula.

Internal Dataverse touch: `bc_customer` virtual (read — name, address, AR balance), `bc_salesorder` virtual (read — history list), `lum_opportunity` (read — pipeline panel), `lum_signspec` (read — recent specs).

## Host-side wiring

### Canvas host (Weekly Scheduler app, Sign Builder Pro app)

```powerfx
// Weekly Scheduler screen — the PCF sits inside a container that fills the screen
WeeklyScheduler1.userEmail = gblUserEmail
WeeklyScheduler1.role = gblRole
WeeklyScheduler1.action = If(IsBlank(gblCtx), Blank(), gblCtx.action)
WeeklyScheduler1.contextJson = If(IsBlank(gblCtx), "", JSON(gblCtx))
WeeklyScheduler1.returnTo = gblReturnTo
WeeklyScheduler1.weekStart = Coalesce(
  DateValue(gblCtx.weekStart),
  Today() - Weekday(Today(), Monday) + 1
)
WeeklyScheduler1.deptFilter = Coalesce(gblCtx.deptFilter, gblRole)

// React to outputs
OnChange:
  If(WeeklyScheduler1.exitRequested,
    Launch(WeeklyScheduler1.exitTarget),
    !IsBlank(WeeklyScheduler1.taskClicked),
      Navigate(scrTaskDetail, None, { taskId: WeeklyScheduler1.taskClicked }),
    !IsBlank(WeeklyScheduler1.taskAssigned),
      // No screen change — let the PCF self-refresh
      Refresh('lum_task')
  )
```

### Model-driven host (Sales Hub on Account form)

In a model-driven app, the PCF is bound to a form field via the form designer. The five universal params + `salesHistoryRange` are configured in the **Component property bindings** dialog; `customerId` is auto-wired.

```
Form: Account
  └─ Section: "Customer 360"
     └─ PCF: CustomerDashboard
        ├─ customerId: [primary record] (auto)
        ├─ userEmail: bound to context.userSettings.userId via a form script
        ├─ role: bound to a custom field lum_userrole on systemuser
        ├─ action: bound to URL param "action" via form OnLoad script
        ├─ contextJson: bound to URL param "contextJson"
        └─ returnTo: bound to URL param "returnTo" (default "")
```

A small **form OnLoad script** reads `Xrm.Utility.getPageContext()`'s query params and pushes them into the bound attributes so the PCF receives them without any further canvas glue.

## Migration checklist per React app

This is the order each owner should follow to wrap their existing app:

### Phase A — Scaffold (1–2 days)
1. `npm i -g pac` → `pac pcf init --name <Name> --namespace lumineo --template field --framework react`
2. Move existing React source into `<NewPCF>/src/`. Delete the generated demo component.
3. Replace the generated `index.ts` with the lifecycle skeleton above.
4. Add the universal 5 inputs + exit pair to `ControlManifest.Input.xml`. Add app-specific inputs from the catalog above.
5. `npm run build` — confirm bundle compiles. Fix any web-only API (e.g. `window.localStorage` direct → fall back to in-memory when `context.mode.allowAccessToSettingsStore` is false).

### Phase B — Dataverse plumbing (2–4 days)
6. Replace every existing fetch/axios call to a mock API with `context.webAPI.retrieveRecord` / `retrieveMultipleRecords` / `createRecord` / `updateRecord`.
7. Replace every direct identity check (`auth.user.email`) with the `userEmail` prop passed from `index.ts`.
8. If the app made BC calls directly, route them through `lum_pendingbcwrites` per doc 14.
9. Declare every entity the PCF reads/writes in the manifest's `<data-set>` block.

### Phase C — Host integration (2 days)
10. Build the canvas (or extend the MDA form) that hosts the PCF. Bind inputs per the catalog above.
11. Wire `OnChange` on the PCF instance to react to `taskClicked`, `specSaved`, `exitRequested`, etc.
12. Verify launch from Switchboard with all five `action` cases the catalog lists.

### Phase D — Solution + deploy (1 day)
13. `pac solution init` in a sibling folder; `pac solution add-reference --path <pcfFolder>`.
14. `msbuild /t:build /restore` → managed solution `.zip`.
15. Import into Dev environment; smoke-test the host app; export managed; promote to Test.

### Phase E — Production polish (ongoing)
16. Theming pass — pick up Lumineo CSS tokens via `context.fluentDesignLanguage`.
17. Mobile player check — sub-300px width sanity.
18. Telemetry — fire `context.factory.requestRender()` after each lifecycle event into App Insights via a host-side flow.

Targeted timeline: ~2 weeks per React app, in parallel teams. The three owners can ship independently because each PCF is a separate solution.

## Testing strategy

| Layer | Tool | What it checks |
|---|---|---|
| Unit (React) | Vitest + RTL | Components render, callbacks fire, branching on `action` correct |
| PCF harness | `pcf-scripts` test harness (`npm start`) | Manifest is valid, inputs/outputs surface in the local browser harness |
| Integration | Playwright pointed at a Dev canvas app | Switchboard → PCF cold-boot → action behaves end-to-end |
| Manual | Power Apps mobile player on iOS + Android | Touch targets, scroll, offline banner |

The React inside each PCF keeps its existing Vitest/Jest suite. New tests cover the `safeParseJson` boundary, the `ctx.action` dispatch table, and the `onExit` callback shape.

## Build & packaging

Each PCF lives in its own Linear project's repo (e.g. `lumineo-sign-builder-pcf`) and produces:
- A managed solution `LumineoSignBuilder_managed.zip` — contains the PCF, no host
- The host canvas/MDA app ships as a separate managed solution from `Lumineo-Switchboard` or its own per-app solution

This separation lets the React-app team rev the PCF without re-exporting the canvas wrapper. Bumping the PCF version number in `ControlManifest.Input.xml` triggers an in-place upgrade when the new solution is imported.

## Version negotiation

When the universal input contract evolves, follow the same `schemaVersion` rule as doc 15:

- Adding a new optional input: no version bump in either doc.
- Adding a new *required* input: bump `schemaVersion` in doc 15, ship a fallback default in the PCF's `updateView` until all hosts are updated.
- Removing/renaming an input: bump major; coordinate redeploy of host + PCF together.

The PCF's `updateView` always inspects `ctx.schemaVersion`. If the host sends an older version than the PCF expects, render in compatibility mode (use defaults); if newer, log a warning and render best-effort.

## Open questions

These should be confirmed during the platform-foundation sprint (Linear `Platform Foundation` project):

1. **PCF v1 vs v2 (virtual control)** — confirm tenant allows v2 React virtual controls (requires modern runtime). All three controls assume v2.
2. **Component library reuse** — should the three PCFs share a `@lumineo/shared-ui` npm package (buttons, modals, theming) or vendor their own? Strongly recommend shared, but it adds a tiny inter-repo ALM step.
3. **PCF telemetry pipeline** — Application Insights instrumentation key vs a Lumineo-owned Power Automate logging endpoint. Whichever lands, every PCF emits `init`, `updateView` count, and error envelope.
4. **Bundle size budget** — current Sign Builder React app is ~340 KB minified. PCF runtime supports it but cold-load on tablet can hit 1–2s. Confirm acceptable; if not, code-split via dynamic import on the canvas form's "Open builder" tap.
5. **`context.factory.requestRender()` vs internal React state** — for fast in-PCF state (e.g. drag-and-drop hover), bypass the PCF render cycle and rely on React's reconciler; only call `notifyOutputChanged` when an output actually changes.

Once Phase A scaffolds exist for one app (Sign Builder Pro is the recommended first since it has the most contained surface), revise this doc with the lessons learned before the other two start.
