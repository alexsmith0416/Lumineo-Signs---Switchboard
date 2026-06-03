// Data-driven piece-type definitions consumed by src/lib/engine.ts.
//
// Every visible sign-type sheet in the blank workbook is mapped to one entry
// here. The four formulas explicitly anchored in docs/16-estimating.md are
// fully implemented; every other entry carries a `status: 'todo'` flag and a
// `workbookSheet` pointer so the formula can be authored next without having
// to re-trace which sheet it came from.
//
// The engine treats `status: 'verified'` types as authoritative and
// `status: 'todo'` types as input-only stubs that compute zero — the UI still
// renders them in the type picker, but their math is pending. This avoids
// silently producing wrong totals for under-specified types.

import { RATES, TABLES, tierFor, type RateTier } from './rates';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type InputKind = 'number' | 'integer' | 'text' | 'select';

export interface InputDef {
  readonly key: string;
  readonly label: string;
  readonly kind: InputKind;
  /** Default value when the user adds a new piece. */
  readonly default?: number | string;
  /** Min/max for number inputs; choices for selects. */
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly { value: string; label: string }[];
  /** Unit suffix shown next to the input ("in", "ft", "ea", etc.). */
  readonly unit?: string;
  readonly help?: string;
}

/** A labor line emitted by a piece, pre-computed against the engine's rates. */
export interface ComputedLaborLine {
  readonly workCode: number;
  /** Display description (overrides WC sheet description when set). */
  readonly description?: string;
  readonly hours: number;
}

/** A material line emitted by a piece. unitPrice/unitCost are resolved by the
 *  engine against the catalog; only the item number and qty are required. */
export interface ComputedMaterialLine {
  readonly itemNo: string;
  /** Override the catalog description (used by "EST PAINT - CUSTOM" etc.). */
  readonly description?: string;
  readonly units: number;
  /** Optional explicit unit price — bypasses the catalog lookup. */
  readonly unitPrice?: number;
  readonly unitCost?: number;
  readonly profitPct?: number;
}

export interface ComputedPiece {
  readonly sqft: number;
  readonly labor: readonly ComputedLaborLine[];
  readonly materials: readonly ComputedMaterialLine[];
  /** Free-text notes the engine wants to surface ("formula pending", etc.). */
  readonly notes?: readonly string[];
}

export type PieceCompute = (inputs: Record<string, number | string>) => ComputedPiece;

export interface PieceTypeDef {
  readonly id: string;
  readonly label: string;
  /** Source sheet name in the workbook, for traceability. */
  readonly workbookSheet: string;
  readonly status: 'verified' | 'todo';
  readonly inputs: readonly InputDef[];
  readonly compute: PieceCompute;
  /** Cell references that drive this piece's math — useful for TODO entries
   *  so the next author can jump straight to the right formula. */
  readonly references?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** CEILING(x, step) — round x up to the nearest multiple of step. */
export function ceilingMultiple(x: number, step: number): number {
  if (step <= 0) return x;
  return Math.ceil(x / step) * step;
}

function num(inputs: Record<string, number | string>, key: string, fallback = 0): number {
  const v = inputs[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

const COMMON_HW = {
  H: { key: 'H', label: 'Height', kind: 'number' as const, unit: 'in', min: 0 },
  L: { key: 'L', label: 'Length', kind: 'number' as const, unit: 'in', min: 0 },
  qty: { key: 'qty', label: 'Quantity', kind: 'integer' as const, default: 1, min: 1 },
};

const TODO = (sheet: string, refs: string[] = []): PieceCompute => () => ({
  sqft: 0,
  labor: [],
  materials: [],
  notes: [
    `Engine math pending — see workbook sheet "${sheet}". ` +
      (refs.length ? `Cells: ${refs.join(', ')}.` : ''),
  ],
});

// ---------------------------------------------------------------------------
// VERIFIED piece types (formulas anchored in docs/16-estimating.md)
// ---------------------------------------------------------------------------

// Apply Vinyl Graphics
// sqft = (H * L / 144) * qty
// labor 2416 hours = CEILING(sqft / (Flat 32 | PushThrough 15), 0.5)
const APPLY_VINYL_GRAPHICS: PieceTypeDef = {
  id: 'apply-vinyl-graphics',
  label: 'Apply vinyl graphics',
  workbookSheet: 'Apply vinyl graphics',
  status: 'verified',
  references: ['B6 H', 'B7 L', 'B8 qty', 'G33 hours formula'],
  inputs: [
    COMMON_HW.H,
    COMMON_HW.L,
    COMMON_HW.qty,
    {
      key: 'surface',
      label: 'Surface',
      kind: 'select',
      default: 'flat',
      options: [
        { value: 'flat', label: 'Flat (32 sqft/hr)' },
        { value: 'push-through', label: 'Push-through (15 sqft/hr)' },
      ],
    },
  ],
  compute: (inputs) => {
    const H = num(inputs, 'H');
    const L = num(inputs, 'L');
    const qty = Math.max(1, Math.round(num(inputs, 'qty', 1)));
    const surface = String(inputs.surface ?? 'flat');
    const sqft = (H * L / 144) * qty;
    const rate = surface === 'push-through'
      ? RATES.vinylApplyPushThroughSqftPerHour
      : RATES.vinylApplyFlatSqftPerHour;
    // Workbook uses CEILING(..., 0.5) — half-hour rounding for application.
    const hours = sqft > 0 ? ceilingMultiple(sqft / rate, 0.5) : 0;
    return {
      sqft,
      labor: [{ workCode: 2416, hours }],
      materials: [],
    };
  },
};

// Vinyl Cutting
// sqft = CEILING((H * L) / 144, 4) * qty
// labor 2415 hours = CEILING(sqft / 20, B84) where B84 = 0.25
const VINYL_CUTTING: PieceTypeDef = {
  id: 'vinyl-cutting',
  label: 'Vinyl cutting',
  workbookSheet: 'Vinyl cutting',
  status: 'verified',
  references: ['B6 H', 'B7 L', 'B8 qty', 'G33 hours formula'],
  inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
  compute: (inputs) => {
    const H = num(inputs, 'H');
    const L = num(inputs, 'L');
    const qty = Math.max(1, Math.round(num(inputs, 'qty', 1)));
    const sqftRaw = (H * L) / 144;
    const sqft = sqftRaw > 0 ? ceilingMultiple(sqftRaw, 4) * qty : 0;
    const hours = sqft > 0
      ? ceilingMultiple(sqft / RATES.vinylCutSqftPerHour, RATES.hourRoundingFactor)
      : 0;
    return {
      sqft,
      labor: [{ workCode: 2415, hours }],
      materials: [],
    };
  },
};

// Paint Calculation
// sqft = (H * L / 144) * faces
// auto material "EST PAINT - CUSTOM" units = ROUND(sqft * 100) grams
// labor 2110 hours = sqft / 20 ; labor 2112 hours = sqft / 25
//
// Note: the spec says "labor 2110 hours = sqft/20, 2112 hours = sqft/25", but
// the workbook RateData lists 19 and 23.75 sqft/hr for those rates (cabinet
// paint prep / cabinet paint). We follow the spec's verified values (20 / 25)
// — those are the round numbers the Paint Calculation sheet locks against.
const PAINT_CALCULATION: PieceTypeDef = {
  id: 'paint-calculation',
  label: 'Paint calculation',
  workbookSheet: 'Paint calculation',
  status: 'verified',
  references: ['B6 H', 'B7 L', 'B8 faces'],
  inputs: [
    COMMON_HW.H,
    COMMON_HW.L,
    { key: 'faces', label: 'Faces', kind: 'integer', default: 1, min: 1 },
  ],
  compute: (inputs) => {
    const H = num(inputs, 'H');
    const L = num(inputs, 'L');
    const faces = Math.max(1, Math.round(num(inputs, 'faces', 1)));
    const sqft = (H * L / 144) * faces;
    const grams = sqft > 0 ? Math.round(sqft * RATES.paintGramsPerSqft) : 0;
    const hoursPrep = sqft / 20;
    const hoursPaint = sqft / 25;
    return {
      sqft,
      labor: [
        { workCode: 2110, hours: hoursPrep },
        { workCode: 2112, hours: hoursPaint },
      ],
      materials: grams > 0
        ? [{
            itemNo: 'EST PAINT - CUSTOM',
            description: 'Estimate for Custom Paint Color',
            units: grams,
            unitCost: 0.02856,
            unitPrice: 0.051,
            profitPct: 44.45,
          }]
        : [],
    };
  },
};

// Routed Panel Shapes
// sqft = (H * L / 144) * panels
// labor 2010 setup 1hr + 2010 routing hours = sqft / 50
const ROUTED_PANEL_SHAPES: PieceTypeDef = {
  id: 'routed-panel-shapes',
  label: 'Routed panel shapes',
  workbookSheet: 'Routed panel shapes',
  status: 'verified',
  references: ['B6 H', 'B7 L', 'B8 panels', 'RateData!B27 setup', 'RateData!B29 sqft/hr'],
  inputs: [
    COMMON_HW.H,
    COMMON_HW.L,
    { key: 'panels', label: 'Panels', kind: 'integer', default: 1, min: 1 },
  ],
  compute: (inputs) => {
    const H = num(inputs, 'H');
    const L = num(inputs, 'L');
    const panels = Math.max(1, Math.round(num(inputs, 'panels', 1)));
    const sqft = (H * L / 144) * panels;
    const setup = RATES.routerSetupHours;
    const routing = sqft / RATES.routedPanelShapeSqftPerHour;
    return {
      sqft,
      labor: [
        { workCode: 2010, description: 'Routing Labor — setup', hours: setup },
        { workCode: 2010, description: 'Routing Labor — panel routing', hours: routing },
      ],
      materials: [],
    };
  },
};

// ---------------------------------------------------------------------------
// TODO piece types (input shapes defined; engine math pending).
// Every entry references the workbook sheet so the next author can pick up
// the math from the canonical source.
// ---------------------------------------------------------------------------

const TODO_TYPES: readonly PieceTypeDef[] = [
  {
    id: 'freeform-tm',
    label: 'Freeform time & material',
    workbookSheet: 'Freeform time and material',
    status: 'todo',
    references: ['Catch-all sheet — pure user-entered material + labor lines.'],
    inputs: [
      { key: 'description', label: 'Description', kind: 'text', default: '' },
    ],
    compute: () => ({ sqft: 0, labor: [], materials: [], notes: ['Freeform pieces accept user-entered material and labor lines directly.'] }),
  },
  {
    id: 'alum-pan-sign',
    label: 'Aluminum pan sign',
    workbookSheet: 'Alum pan sign',
    status: 'todo',
    references: ['Pan rate lookup TABLES.pan (sqft → hrs/sqft); paint via panPaint*'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'faces', label: 'Faces', kind: 'integer', default: 1, min: 1 },
    ],
    compute: TODO('Alum pan sign'),
  },
  {
    id: 'economy-pan-sign',
    label: 'Economy pan sign',
    workbookSheet: 'Economy pan sign',
    status: 'todo',
    references: ['Variant of Alum pan sign with reduced fabrication.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Economy pan sign'),
  },
  {
    id: 'post-and-panel',
    label: 'Post and panel sign',
    workbookSheet: 'Post and panel sign',
    status: 'todo',
    references: ['TABLES.postAndPanel; postPanelPostFabFtPerHour for posts.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'postFt', label: 'Total post feet', kind: 'number', default: 0, min: 0, unit: 'ft' },
    ],
    compute: TODO('Post and panel sign'),
  },
  {
    id: 'flat-panels',
    label: 'Flat panels only',
    workbookSheet: 'Flat panels only',
    status: 'todo',
    references: ['acrylicCut / ACMcut / prepaintedAlumCut sqft-per-hour.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      {
        key: 'material',
        label: 'Panel material',
        kind: 'select',
        default: 'acm',
        options: [
          { value: 'acm', label: 'ACM (96 sqft/hr)' },
          { value: 'acrylic', label: 'Acrylic (72 sqft/hr)' },
          { value: 'polycarbonate', label: 'Polycarbonate (48 sqft/hr)' },
          { value: 'prepainted-alum', label: 'Prepainted aluminum (96 sqft/hr)' },
        ],
      },
    ],
    compute: TODO('Flat panels only'),
  },
  {
    id: 'routed-face-only',
    label: 'Routed face only',
    workbookSheet: 'Routed face only',
    status: 'todo',
    references: ['routedFaceFabricationSqftPerHour; letterPerimeterPathFactor.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'inchesOfLetterFab', label: 'Inches of letter fab', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Routed face only'),
  },
  {
    id: 'routed-alum-faces-letters',
    label: 'Routed aluminum faces & letters',
    workbookSheet: 'Routed alum faces letters',
    status: 'todo',
    references: ['routingAluminumInchesPerHour; letterPerimeterPathFactor.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'inchesOfLetterFab', label: 'Inches of letter fab', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Routed alum faces letters'),
  },
  {
    id: 'routed-push-through-acrylic',
    label: 'Routed push-through acrylic',
    workbookSheet: 'Routed push through acrylic',
    status: 'todo',
    references: ['routingPushThroughInchesPerHour.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'inchesOfLetterFab', label: 'Inches of letter fab', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Routed push through acrylic'),
  },
  {
    id: 'sf-routed-cabinet',
    label: 'Single-face routed cabinet',
    workbookSheet: 'Sf routed cabinet',
    status: 'todo',
    references: ['TABLES.routedCabinet for sqft tiers.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'depth', label: 'Depth', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Sf routed cabinet'),
  },
  {
    id: 'df-routed-cabinet',
    label: 'Double-face routed cabinet',
    workbookSheet: 'Df routed cabinet',
    status: 'todo',
    references: ['TABLES.routedCabinet for sqft tiers (DF doubles fab/paint).'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'depth', label: 'Depth', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Df routed cabinet'),
  },
  {
    id: 'sf-acrylic-cabinet',
    label: 'Single-face acrylic cabinet',
    workbookSheet: 'Sf acrylic cabinet',
    status: 'todo',
    references: ['TABLES.acrylicCabinet; acrylicCutSqftPerHour.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'depth', label: 'Depth', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Sf acrylic cabinet'),
  },
  {
    id: 'economy-sf-acrylic',
    label: 'Economy SF acrylic',
    workbookSheet: 'Economy Sf acrylic',
    status: 'todo',
    references: ['Variant of Sf acrylic with reduced fab.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Economy Sf acrylic'),
  },
  {
    id: 'df-acrylic-cabinet',
    label: 'Double-face acrylic cabinet',
    workbookSheet: 'Df acrylic cabinet',
    status: 'todo',
    references: ['TABLES.acrylicCabinet (DF doubles face area).'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Df acrylic cabinet'),
  },
  {
    id: 'sf-flex-cabinet',
    label: 'Single-face flex cabinet',
    workbookSheet: 'Sf flex cabinet',
    status: 'todo',
    references: ['TABLES.flexCabinet; flexFaceAssemblySqftPerHour; flexFaceClipPlasticPerFoot.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Sf flex cabinet'),
  },
  {
    id: 'df-flex-cabinet',
    label: 'Double-face flex cabinet',
    workbookSheet: 'Df flex cabinet',
    status: 'todo',
    references: ['TABLES.flexCabinet (DF doubles face area).'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Df flex cabinet'),
  },
  {
    id: 'pole-cover',
    label: 'Pole cover',
    workbookSheet: 'Pole cover',
    status: 'todo',
    references: [
      'TABLES.polecover; largePoleCoverFaceMaterialChangeSize=50; ',
      'largePoleCoverFrameMultiplier=1.3 above largePoleCoverFrameMultiplierSize=61.',
    ],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'poleHeight', label: 'Pole height', kind: 'number', default: 0, min: 0, unit: 'in' },
    ],
    compute: TODO('Pole cover'),
  },
  {
    id: 'structural-steel',
    label: 'Structural steel fabrication',
    workbookSheet: 'Structural Steel Fab',
    status: 'todo',
    references: ['Work code 2016; engineered by section, not sqft.'],
    inputs: [
      { key: 'description', label: 'Description', kind: 'text', default: '' },
      { key: 'hours', label: 'Estimated hours (2016)', kind: 'number', default: 0, min: 0, unit: 'hr' },
    ],
    compute: TODO('Structural Steel Fab'),
  },
  {
    id: 'reveal',
    label: 'Reveal',
    workbookSheet: 'Reveal',
    status: 'todo',
    references: ['TABLES.reveal; revealPaintPrep/Paint sqft/hour.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Reveal'),
  },
  {
    id: 'crown-cove',
    label: 'Crown cove top',
    workbookSheet: 'Crown cove top',
    status: 'todo',
    references: ['TABLES.crown; crownPaintPrep/Paint sqft/hour.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Crown cove top'),
  },
  {
    id: 'emc-assembly',
    label: 'EMC assembly',
    workbookSheet: 'EMC assembly',
    status: 'todo',
    references: ['TABLES.EMC; emcHandPaintSqftPerHour.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      { key: 'pitch', label: 'Pixel pitch', kind: 'number', default: 0, min: 0, unit: 'mm' },
    ],
    compute: TODO('EMC assembly'),
  },
  {
    id: 'crating',
    label: 'Crating',
    workbookSheet: 'Crating',
    status: 'todo',
    references: ['Sized per piece, hand-entered hours typical.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L,
      { key: 'depth', label: 'Depth', kind: 'number', default: 0, min: 0, unit: 'in' },
      { key: 'qty', label: 'Crates', kind: 'integer', default: 1, min: 1 },
    ],
    compute: TODO('Crating'),
  },
  {
    id: 'led-wiring',
    label: 'LED wiring',
    workbookSheet: 'LED wiring',
    status: 'todo',
    references: ['ledWiringSqftPerHour; synergyLedsPerSqft / quickmodLedsPerSqft.'],
    inputs: [
      COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty,
      {
        key: 'ledFamily',
        label: 'LED family',
        kind: 'select',
        default: 'synergy',
        options: [
          { value: 'synergy', label: 'Synergy 24V (1.3 LEDs/sqft, 108 LEDs/PSU)' },
          { value: 'quickmod', label: 'Quickmod 12V (1.5 LEDs/sqft, 50 LEDs/PSU)' },
        ],
      },
    ],
    compute: TODO('LED wiring'),
  },
  {
    id: 'changeable-copy-face',
    label: 'Changeable copy face',
    workbookSheet: 'Changeable copy face',
    status: 'todo',
    references: ['ccRailFabFtPerHour; dividerBarFtPerHour.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Changeable copy face'),
  },
  {
    id: 'flex-face-assembly',
    label: 'Flex face assembly',
    workbookSheet: 'Flex face assembly',
    status: 'todo',
    references: ['flexFaceAssemblySqftPerHour; clip plastic/metal per ft.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Flex face assembly'),
  },
  {
    id: 'routed-face-assembly',
    label: 'Routed face assembly',
    workbookSheet: 'Routed face assembly',
    status: 'todo',
    references: ['routedBackerAssemblySqftPerHour; retainerAssemblySqftPerHour.'],
    inputs: [COMMON_HW.H, COMMON_HW.L, COMMON_HW.qty],
    compute: TODO('Routed face assembly'),
  },
  {
    id: 'trimcap-letter-face',
    label: 'Trimcap letter face',
    workbookSheet: 'Trimcap letter face',
    status: 'todo',
    references: ['trimCapFaceFabInchesPerHour.'],
    inputs: [
      { key: 'inches', label: 'Letter perimeter inches', kind: 'number', default: 0, min: 0, unit: 'in' },
      { key: 'qty', label: 'Letters', kind: 'integer', default: 1, min: 1 },
    ],
    compute: TODO('Trimcap letter face'),
  },
  {
    id: 'channel-letter-fabrication',
    label: 'Channel letter fabrication',
    workbookSheet: 'Channel letter fabrication',
    status: 'todo',
    references: [
      'channelLetterBlockFabInchesPerHour / serif / script by typeface.',
    ],
    inputs: [
      { key: 'inches', label: 'Letter perimeter inches', kind: 'number', default: 0, min: 0, unit: 'in' },
      { key: 'qty', label: 'Letters', kind: 'integer', default: 1, min: 1 },
      {
        key: 'face',
        label: 'Typeface',
        kind: 'select',
        default: 'block',
        options: [
          { value: 'block', label: 'Block (18 in/hr)' },
          { value: 'serif', label: 'Serif (12 in/hr)' },
          { value: 'script', label: 'Script (8 in/hr)' },
        ],
      },
    ],
    compute: TODO('Channel letter fabrication'),
  },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PIECE_TYPES: readonly PieceTypeDef[] = Object.freeze([
  APPLY_VINYL_GRAPHICS,
  VINYL_CUTTING,
  PAINT_CALCULATION,
  ROUTED_PANEL_SHAPES,
  ...TODO_TYPES,
]);

export const PIECE_TYPE_BY_ID: ReadonlyMap<string, PieceTypeDef> = new Map(
  PIECE_TYPES.map(t => [t.id, t])
);

export function getPieceType(id: string): PieceTypeDef | undefined {
  return PIECE_TYPE_BY_ID.get(id);
}

/** Convenience re-export so engine.ts can pull tier lookups without
 *  re-importing from rates.ts. */
export { tierFor, type RateTier, TABLES, RATES };
