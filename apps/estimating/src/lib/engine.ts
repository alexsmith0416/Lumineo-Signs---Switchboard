// Estimating engine — pure functions, no React, no I/O. Drives every
// computation in the app and is the source of truth that the acceptance
// test exercises.
//
// The engine is intentionally narrow:
//   1. computePiece(type, inputs)  — runs the type's `compute` to produce
//      sqft + labor lines + material lines, then attaches resolved unit prices
//      from the catalog and resolved hourly rates from the work-code table.
//   2. pieceTotal / projectTotal   — sums lines.
//   3. aggregateForBC(project)     — collapses every piece's lines into the
//      BCI (materials by item #) and BCL (labor hours by resource #) shapes
//      that Business Central expects to import.

import { CATALOG, type CatalogItem } from '../data/catalog';
import { WORK_CODES_BY_CODE, SHOP_LABOR_RATE, type WorkCode } from '../data/workcodes';
import {
  type PieceTypeDef,
  type ComputedLaborLine,
  type ComputedMaterialLine,
  getPieceType,
} from '../data/pieceTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PieceInputs {
  readonly [key: string]: number | string;
}

export interface Piece {
  readonly id: string;
  /** Piece-type id (e.g. 'apply-vinyl-graphics'). */
  readonly typeId: string;
  /** User-supplied label (free-form). */
  readonly label?: string;
  readonly inputs: PieceInputs;
  /** Material lines the user added on top of any auto-computed ones. */
  readonly extraMaterials?: readonly ComputedMaterialLine[];
  /** Labor lines the user added on top of any auto-computed ones. */
  readonly extraLabor?: readonly ComputedLaborLine[];
}

export interface ResolvedMaterialLine {
  readonly itemNo: string;
  readonly description: string;
  readonly units: number;
  readonly unitCost: number;
  readonly unitPrice: number;
  readonly profitPct: number;
  readonly total: number;
}

export interface ResolvedLaborLine {
  readonly workCode: number;
  readonly description: string;
  readonly hours: number;
  readonly hourlyRate: number;
  readonly total: number;
}

export interface ComputedPieceResult {
  readonly piece: Piece;
  readonly type: PieceTypeDef;
  readonly sqft: number;
  readonly materials: readonly ResolvedMaterialLine[];
  readonly labor: readonly ResolvedLaborLine[];
  readonly materialTotal: number;
  readonly laborTotal: number;
  readonly total: number;
  readonly notes: readonly string[];
}

export interface Project {
  readonly id: string;
  readonly jobNumber: string;
  readonly jobName: string;
  readonly estimator: string;
  readonly description: string;
  readonly pieces: readonly Piece[];
}

export interface ComputedProject {
  readonly project: Project;
  readonly pieces: readonly ComputedPieceResult[];
  readonly materialTotal: number;
  readonly laborTotal: number;
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Catalog / work-code lookups
// ---------------------------------------------------------------------------

const CATALOG_BY_NO: ReadonlyMap<string, CatalogItem> = new Map(
  CATALOG.map(i => [i.no, i])
);

export function findCatalogItem(itemNo: string): CatalogItem | undefined {
  return CATALOG_BY_NO.get(itemNo);
}

export function searchCatalog(query: string, limit = 25): readonly CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.slice(0, limit);
  const out: CatalogItem[] = [];
  for (const item of CATALOG) {
    if (item.no.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)) {
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function resolveWorkCode(code: number): WorkCode {
  const wc = WORK_CODES_BY_CODE.get(code);
  if (wc) return wc;
  // Unknown work codes are billed at the shop labor rate with a synthesised
  // description, so the UI can still show *something* without throwing.
  return { code, description: `Work code ${code}`, hourlyRate: SHOP_LABOR_RATE };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function resolveMaterial(line: ComputedMaterialLine): ResolvedMaterialLine {
  const catalogHit = findCatalogItem(line.itemNo);
  const description = line.description ?? catalogHit?.description ?? line.itemNo;
  const unitCost = line.unitCost ?? catalogHit?.unitCost ?? 0;
  const unitPrice = line.unitPrice ?? catalogHit?.unitPrice ?? 0;
  const profitPct = line.profitPct ?? catalogHit?.profitPct ?? 0;
  const total = round4(unitPrice * line.units);
  return {
    itemNo: line.itemNo,
    description,
    units: line.units,
    unitCost,
    unitPrice,
    profitPct,
    total,
  };
}

function resolveLabor(line: ComputedLaborLine): ResolvedLaborLine {
  const wc = resolveWorkCode(line.workCode);
  return {
    workCode: line.workCode,
    description: line.description ?? wc.description,
    hours: line.hours,
    hourlyRate: wc.hourlyRate,
    total: round4(line.hours * wc.hourlyRate),
  };
}

// ---------------------------------------------------------------------------
// Compute piece / project
// ---------------------------------------------------------------------------

export function computePiece(piece: Piece): ComputedPieceResult {
  const type = getPieceType(piece.typeId);
  if (!type) {
    throw new Error(`Unknown piece type: ${piece.typeId}`);
  }
  const computed = type.compute(piece.inputs);
  const autoMaterials = computed.materials.map(resolveMaterial);
  const autoLabor = computed.labor.map(resolveLabor);
  const extraMaterials = (piece.extraMaterials ?? []).map(resolveMaterial);
  const extraLabor = (piece.extraLabor ?? []).map(resolveLabor);
  const materials = [...autoMaterials, ...extraMaterials];
  const labor = [...autoLabor, ...extraLabor];
  const materialTotal = round4(sum(materials.map(m => m.total)));
  const laborTotal = round4(sum(labor.map(l => l.total)));
  return {
    piece,
    type,
    sqft: computed.sqft,
    materials,
    labor,
    materialTotal,
    laborTotal,
    total: round4(materialTotal + laborTotal),
    notes: computed.notes ?? [],
  };
}

export function computeProject(project: Project): ComputedProject {
  const pieces = project.pieces.map(computePiece);
  const materialTotal = round4(sum(pieces.map(p => p.materialTotal)));
  const laborTotal = round4(sum(pieces.map(p => p.laborTotal)));
  return {
    project,
    pieces,
    materialTotal,
    laborTotal,
    total: round4(materialTotal + laborTotal),
  };
}

// ---------------------------------------------------------------------------
// Business Central aggregation (BCI + BCL)
// ---------------------------------------------------------------------------

export interface BCIRow {
  readonly jobNumber: string;
  readonly taskNumber: string;
  readonly itemNumber: string;
  readonly description: string;
  readonly unitCost: number;
  readonly profitPct: number;
  readonly unitPrice: number;
  readonly quantity: number;
}

export interface BCLRow {
  readonly jobNumber: string;
  readonly resourceNumber: number;
  readonly runTime: number;
}

/** Default BC job task number applied to all materials. The workbook uses
 *  "3030" on the CNB job — overridable per-project later. */
export const DEFAULT_TASK_NUMBER = '3030';

export interface BCExport {
  readonly bci: readonly BCIRow[];
  readonly bcl: readonly BCLRow[];
  readonly materialTotal: number;
  readonly laborTotal: number;
  readonly total: number;
}

export function aggregateForBC(
  project: Project | ComputedProject,
  options?: { taskNumber?: string }
): BCExport {
  const cp = 'pieces' in project && 'project' in project
    ? (project as ComputedProject)
    : computeProject(project as Project);
  const taskNumber = options?.taskNumber ?? DEFAULT_TASK_NUMBER;
  const jobNumber = cp.project.jobNumber;

  // BCI — aggregate materials by item number, summing units.
  const matByItem = new Map<string, BCIRow>();
  for (const p of cp.pieces) {
    for (const m of p.materials) {
      const key = m.itemNo;
      const existing = matByItem.get(key);
      if (existing) {
        matByItem.set(key, { ...existing, quantity: existing.quantity + m.units });
      } else {
        matByItem.set(key, {
          jobNumber,
          taskNumber,
          itemNumber: m.itemNo,
          description: m.description,
          unitCost: m.unitCost,
          profitPct: m.profitPct,
          unitPrice: m.unitPrice,
          quantity: m.units,
        });
      }
    }
  }
  const bci = Array.from(matByItem.values()).sort((a, b) =>
    a.itemNumber.localeCompare(b.itemNumber)
  );

  // BCL — aggregate labor by resource (work code), summing hours.
  const laborByCode = new Map<number, number>();
  for (const p of cp.pieces) {
    for (const l of p.labor) {
      laborByCode.set(l.workCode, (laborByCode.get(l.workCode) ?? 0) + l.hours);
    }
  }
  const bcl: BCLRow[] = Array.from(laborByCode.entries())
    .filter(([, hrs]) => hrs > 0)
    .map(([code, runTime]) => ({ jobNumber, resourceNumber: code, runTime: round4(runTime) }))
    .sort((a, b) => a.resourceNumber - b.resourceNumber);

  // Recompute totals from the aggregated rows so this function is
  // self-consistent — it should match cp.total when the project came from a
  // ComputedProject we just built.
  const materialTotal = round4(sum(bci.map(r => r.unitPrice * r.quantity)));
  const laborTotal = round4(
    sum(bcl.map(r => r.runTime * (resolveWorkCode(r.resourceNumber).hourlyRate)))
  );

  return {
    bci,
    bcl,
    materialTotal,
    laborTotal,
    total: round4(materialTotal + laborTotal),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Round to 4 dp — keeps the workbook's hundredths-of-a-cent precision so
 *  per-piece totals like $276.264 reconcile cleanly. */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Round to 2 dp for display ($currency style). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
