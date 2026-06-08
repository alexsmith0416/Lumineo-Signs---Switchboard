# Sign Builder Pro → Estimating handoff

This document is the **canonical contract** between the Sign Builder Pro
sub-app and the Estimating sub-app
([Linear: Estimating — Power Apps Code App](https://linear.app/lumineosigns/project/estimating-power-apps-code-app-240624c85b27)
— ALE-234 → ALE-246). It satisfies the Sign Builder Pro side of
**ALE-244** (`Sign Builder Pro import — pre-fill a piece from a sign spec`).

## Trigger surface

Two buttons live in the Builder formbar's action group:

| Button | Behavior |
| --- | --- |
| **$ Ballpark** | Opens an in-app modal showing a rough cost breakdown computed **locally** from the spec's dimensions + material choices. Labeled "rough estimate — confirm with Estimating for a binding number". Includes a "Send to Estimating" CTA at the bottom. |
| **→ Send to Estimating** | Builds the handoff payload and opens the Estimating app in a new tab via `window.open(buildEstimatingUrl(payload), "_blank")`. |

The Ballpark calculation lives in `app/src/domain/ballpark.ts` and uses
$/sqft + sqft/hr multipliers per piece type. These are deliberately
conservative placeholders; the real number comes from the Estimating
app once it's resolving prices against `lum_invitem`, `lum_workcode`,
and `lum_ratedata` from the BC catalog.

## URL format

```
https://estimating.lumineosigns.com/#/import?payload=<base64url-json>
```

The Estimating app's base URL is read at runtime from
`window.LUMINEO_ESTIMATING_URL`, falling back to
`https://estimating.lumineosigns.com/`. Override in the host page or in
`docs/deploy.md` when the Estimating app is deployed.

Encoding details:

- Payload is `JSON.stringify(<payload object below>)`.
- That string is encoded with **base64url** (`+ → -`, `/ → _`, no `=` padding) so it round-trips cleanly through URL params.
- The Estimating app's import route should base64url-decode the param, parse the JSON, and validate the `version` field before reading.

## Payload schema (v1)

```ts
type EstimatingHandoffPayload = {
  version: 1;
  source: "sign-builder-pro";
  sentAt: string;          // ISO timestamp

  specId?: string;         // lum_signspecification GUID
  jobId?: string;          // Project Scheduler Job GUID (cross-app)
  opportunityId?: string;  // Sales Hub Opportunity GUID (cross-app)

  customerName?: string;
  projectName?: string;
  signName?: string;       // SBP's name field — becomes lum_estimate.lum_name
  productCode?: string;    // SBP's full product code, e.g. "WC-DF-IL-RFPB-P-CV-WB-WH"
  notes?: string;          // SBP's notes (lum_signspecification.lum_notes)

  pieces: EstimatingPieceDraft[];
};

type EstimatingPieceDraft = {
  pieceType: EstimatingPieceType;  // must match a workbook sheet name
  qty: number;
  heightIn: string;
  lengthIn: string;
  depthIn?: string;
  options?: string;                // surface / option key per piece type
  materialHints?: MaterialHint[];
  notes?: string;
};

type EstimatingPieceType =
  | "Apply Vinyl Graphics" | "Vinyl Cutting" | "Paint Calculation"
  | "Sf Routed Cabinet"    | "Df Routed Cabinet"
  | "Sf Acrylic Cabinet"   | "Df Acrylic Cabinet"  | "Economy Acrylic Cabinet"
  | "Sf Flex Cabinet"      | "Df Flex Cabinet"
  | "Alum/Economy Pan"     | "Post & Panel"
  | "Pole Cover"           | "Structural Steel"
  | "Channel Letter Fabrication" | "Trimcap Letter Face"
  | "Routed Alum Faces Letters"  | "Routed Push-Through Acrylic"
  | "Cast Aluminum Letters"      | "Formed Plastic Letters"
  | "FCO Acrylic Letters"        | "EMC Assembly"      | "LED Wiring";

type MaterialHint = {
  description: string;     // search hint for the lum_invitem picker
  units?: number;
  category?: "Vinyl" | "Paint" | "Substrate" | "Hardware" | "Electrical";
};
```

## Mapping rules (SBP → Estimating pieces)

A single SBP spec can produce **multiple** Estimating pieces — the
primary piece (the sign itself) plus zero or more additional pieces for
graphics, paint, illumination, and ground-mount infrastructure. The
canonical translation is implemented in
`app/src/domain/estimateMapping.ts:mapSpecToEstimatePieces()`.

**Primary piece selection** (by SBP `signTypeCode` + `faces` + `faceType`):

| SBP combination | Estimating piece type |
| --- | --- |
| WC / MN / PS + SF + AT / RFPB / RFPT | Sf Routed Cabinet |
| WC / MN / PS + DF + AT / RFPB / RFPT | Df Routed Cabinet |
| WC / MN / PS + SF + PT | Sf Acrylic Cabinet |
| WC / MN / PS + DF + PT | Df Acrylic Cabinet |
| WC / MN / PS + SF + DF (direct print) | Sf Flex Cabinet |
| WC / MN / PS + DF + DF | Df Flex Cabinet |
| PP | Post & Panel |
| AP | Alum/Economy Pan (options: "Aluminum") |
| EP | Alum/Economy Pan (options: "Economy") |
| FL | Channel Letter Fabrication (options: "Front-Lit") |
| HL | Channel Letter Fabrication (options: "Halo-Lit") |
| CL | Channel Letter Fabrication (options: "Combo-Lit") |
| AL | Routed Alum Faces Letters |
| CA | Cast Aluminum Letters |
| PL | Formed Plastic Letters |
| AC | FCO Acrylic Letters |
| EM | EMC Assembly |

**Additional pieces** (added on top of the primary):

| SBP condition | Adds piece |
| --- | --- |
| `vinyl === "CV"` | Vinyl Cutting + Apply Vinyl Graphics |
| `vinyl === "DV"` | Apply Vinyl Graphics (options: "Digital Print") |
| `vinyl === "FX"` | Apply Vinyl Graphics (options: "Wrap Film") |
| `finish === "P"` | Paint Calculation (qty=2 if double-face, else 1) |
| `illumination` ∈ `IL`, `EL` AND not a letter type | LED Wiring |
| `signTypeCode` ∈ `MN`, `PS` AND `poleType === "New Pole"` | Pole Cover + Structural Steel |
| Front-lit channel letters (`FL` or `CL`) | Trimcap Letter Face |

**Why a separate Vinyl Cutting + Apply Vinyl Graphics for CV:** the
workbook splits these because cutting and application are different
work codes (2415 vs 2416) running at different sqft/hr rates. The
Estimating app's calc engine needs both to compute labor honestly.

**Why Paint Calculation qty matches face count:** the workbook's Paint
sheet uses `sqft = (H × L / 144) × faces`. SBP's `faces` field already
captures SF / DF / NA so we forward it as the piece qty (single-face = 1,
double-face = 2, letters = 1).

## What the Estimating app needs to do

1. Detect `?payload=` on the `/import` route on mount.
2. Base64url-decode → `JSON.parse` → validate `version === 1`.
3. Create a new `lum_estimate` row seeded from the payload header
   (`customerName`, `projectName`, `signName` → `lum_name`, `notes`,
   `jobId` / `opportunityId` / `specId` links).
4. For each `pieces[]` element, create a `lum_estimatepiece` row with
   the piece type pre-selected and the dimensions / options /
   materialHints pre-populated. The user reviews + finalizes; the
   estimate isn't auto-saved.
5. Surface the SBP spec ID in the estimate header so navigating back
   to "Sign Builder Pro · this spec" works from the estimate view.

## Versioning

If the payload shape changes, bump `ESTIMATING_PAYLOAD_VERSION` (in
`app/src/data/estimatingService.ts`). The Estimating app should reject
or warn on payloads with a newer version than it knows.

## Reverse direction (future)

Not built yet, but the contract leaves room: Estimating could open a
`https://signbuilderpro.lumineosigns.com/#/builder?specId=<id>` URL
to navigate back to the SBP spec that started the estimate. SBP's
existing `useLaunchParams()` already reads `specId`.
