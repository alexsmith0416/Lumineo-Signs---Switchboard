# Sign Builder Pro → Estimating handoff (v2)

Canonical contract between the Sign Builder Pro sub-app and the
Estimating sub-app. The Estimating app implementation lives on the
`claude/estimating-app` branch — types referenced below come from
`apps/estimating/src/lib/engine.ts` and
`apps/estimating/src/data/pieceTypes.ts`.

## Trigger surface (Sign Builder Pro side)

Two buttons in the Builder formbar's action group:

| Button | Behavior |
| --- | --- |
| **$ Ballpark** | Local cost breakdown modal — rough material + labor per piece type. Disclaimed as non-binding; the real estimate uses Estimating's BC catalog. Includes Copy summary + Send to Estimating CTAs. |
| **→ Send to Estimating** | Builds the v2 handoff payload and opens `${estimatingUrl}#import?payload=<base64url-json>` in a new tab. |

## URL format

```
https://estimating.lumineosigns.com/#import?payload=<base64url-json>
```

- Base URL is read from `window.LUMINEO_ESTIMATING_URL` at runtime
  (falls back to `https://estimating.lumineosigns.com/`); swap at
  deploy time without a Vite rebuild.
- Payload is `JSON.stringify(payload)` then base64url (`+ → -`, `/ → _`,
  no `=` padding).
- The Estimating app's reader on mount: read `window.location.hash`,
  match `import?payload=...`, base64url-decode, JSON.parse, validate
  `version === 2`.

## Payload schema (v2)

```ts
type EstimatingHandoffPayload = {
  version: 2;
  source: "sign-builder-pro";
  sentAt: string;            // ISO timestamp

  specId?: string;           // lum_signspecification GUID
  jobId?: string;            // Project Scheduler Job GUID
  opportunityId?: string;    // Sales Hub Opportunity GUID

  customerName?: string;
  projectName?: string;
  signName?: string;         // → lum_estimate.lum_name
  productCode?: string;      // SBP's full product code
  notes?: string;

  pieces: EstimatingPieceDraft[];
};

type EstimatingPieceDraft = {
  /** Estimating piece-type slug. Must be a known id from
      apps/estimating/src/data/pieceTypes.ts → PIECE_TYPES. */
  typeId: PieceTypeId;
  /** Free-form label for the row. Estimating uses this if set,
      otherwise falls back to the piece type's `label`. */
  label?: string;
  /** Inputs the piece type's compute() reads. Keys VARY per type —
      see pieceTypes.ts. Common keys: H, L, D, qty. All inches are
      NUMBERS (Estimating's num() helper). */
  inputs: Record<string, number | string>;
  /** Pre-filled material lines. itemNo can be a hint — Estimating
      resolves to the catalog item by lookup. */
  extraMaterials?: Array<{ itemNo: string; units: number; description?: string }>;
  /** Pre-filled labor lines. Rare from the SBP side. */
  extraLabor?: Array<{ workCode: number; hours: number; description?: string }>;
};

type PieceTypeId =
  | "freeform-tm"
  | "apply-vinyl-graphics" | "vinyl-cutting" | "paint-calculation"
  | "routed-panel-shapes"
  | "alum-pan-sign" | "economy-pan-sign" | "post-and-panel" | "flat-panels"
  | "routed-face-only" | "routed-alum-faces-letters" | "routed-push-through-acrylic"
  | "sf-routed-cabinet"  | "df-routed-cabinet"
  | "sf-acrylic-cabinet" | "df-acrylic-cabinet" | "economy-sf-acrylic"
  | "sf-flex-cabinet"    | "df-flex-cabinet"
  | "pole-cover" | "structural-steel"
  | "channel-letter-fabrication" | "trimcap-letter-face"
  | "emc-assembly" | "led-wiring";
```

## SBP → Estimating typeId mapping (primary piece)

| SBP (signTypeCode + faces + faceType) | Estimating typeId |
| --- | --- |
| WC / MN / PS + SF + AT or RFPB or RFPT | `sf-routed-cabinet` |
| WC / MN / PS + DF + AT or RFPB or RFPT | `df-routed-cabinet` |
| WC / MN / PS + SF + PT | `sf-acrylic-cabinet` |
| WC / MN / PS + DF + PT | `df-acrylic-cabinet` |
| WC / MN / PS + SF + DF | `sf-flex-cabinet` |
| WC / MN / PS + DF + DF | `df-flex-cabinet` |
| WC / MN / PS + no faceType yet | `freeform-tm` (estimator picks) |
| PP | `post-and-panel` |
| AP | `alum-pan-sign` |
| EP | `economy-pan-sign` |
| FL / HL / CL | `channel-letter-fabrication` |
| AL | `routed-alum-faces-letters` |
| AC | `routed-push-through-acrylic` |
| CA / PL | `freeform-tm` (no exact match; estimator picks) |
| EM | `emc-assembly` |

## Additional pieces per SBP option

| SBP condition | Adds piece |
| --- | --- |
| `vinyl === "CV"` | `vinyl-cutting` + `apply-vinyl-graphics` |
| `vinyl === "DV"` or `"FX"` | `apply-vinyl-graphics` (surface="flat" or "push-through") |
| `finish === "P"` | `paint-calculation` (faces=2 for DF, else 1) |
| `illumination ∈ {IL, EL}` AND non-letter sign type | `led-wiring` |
| `signTypeCode ∈ {MN, PS}` AND `poleType === "New Pole"` | `pole-cover` + `structural-steel` |
| `signTypeCode ∈ {FL, CL}` (front-lit / combo letters) | `trimcap-letter-face` |

## Input-key conventions (per piece type)

Each piece type's `compute()` reads specific keys from `inputs`. The
SBP mapping populates exactly the keys that piece type needs. Reference
the InputDef arrays in `pieceTypes.ts` for the full per-type vocabulary;
the common cases:

| Input key | Type | Meaning |
| --- | --- | --- |
| `H`, `L`, `D` | number (inches) | Height / length / depth |
| `qty` | integer | Quantity of this piece |
| `faces` | integer | Number of painted faces (paint-calculation only) |
| `inchesOfCopy` | number | Letter / routed-copy perimeter inches |
| `surface` | `"flat"` or `"push-through"` | Apply-vinyl-graphics rate |
| `pushThrough` | `"Yes"` or `"No"` | Routed-cabinet copy variant |
| `shape` | `"Rectangular"` or `"Radius/Angle"` | Cabinet fabrication tier |
| `extraColors` | integer | Extra paint colors |
| `dividerRows` | integer | Changeable-copy divider rows |
| `ledFamily` | `"synergy"` or `"quickmod"` | LED wiring family |
| `face` | `"block"`, `"serif"`, `"script"` | Channel-letter typeface |
| `inches` | number | Trim-cap / channel-letter perimeter inches |
| `hours` | number | Freeform / structural-steel labor hours |

## Estimating app's import-reader responsibilities

1. On mount, parse `window.location.hash` for `import?payload=<base64url>`.
2. Base64url-decode → JSON.parse → validate `version === 2`.
3. Create a new `Project` from the header fields (`customerName`,
   `projectName`, `signName` → `jobName`, `notes` → `description`).
4. For each `pieces[]` element, create a `Piece` with the supplied
   `typeId`, `label`, `inputs` map, and (optionally) `extraMaterials`.
5. Set the new project as active; clear the URL hash so a refresh
   doesn't re-import.
6. **Don't auto-save** — user reviews + finalizes, mirroring the
   AI-draft pattern from ALE-245.

## Dimensions convention

Sign Builder Pro stores dimensions as a string holding TOTAL INCHES
(e.g. `"42"` for 3'6"). The Builder UI shows paired ft + in textboxes
via `app/src/ui/DimensionInput.tsx`; the converter helpers in
`app/src/domain/dimensions.ts` (`splitFtIn` / `joinFtIn` /
`formatDimension`) handle the split/join.

The handoff payload converts inches strings → numbers via `Number()` at
the mapping boundary so `inputs.H` and `inputs.L` arrive as numbers
(Estimating's `num()` helper expects numbers). Estimating's piece-type
inputs are all numeric where dimensions are concerned.

When the Estimating app's UI builds the piece input cascade
(ALE-239 / ALE-240), it should adopt the same paired ft+in pattern so
users see consistent measurement entry across both apps. The dimension
helpers are pure functions safe to copy across.

## Versioning

Bump `ESTIMATING_PAYLOAD_VERSION` (in `app/src/data/estimatingService.ts`)
whenever the payload shape changes incompatibly. Estimating's reader
should reject / warn on unknown versions.

## Reverse direction

Estimating can navigate back to the originating SBP spec via
`https://signbuilderpro.lumineosigns.com/#/builder?specId=<id>`. SBP's
`useLaunchParams()` already reads `specId`.
