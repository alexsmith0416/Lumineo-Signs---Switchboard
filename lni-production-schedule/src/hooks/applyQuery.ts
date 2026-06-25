// ─────────────────────────────────────────────────────────────────────────────
// Post-processing applied to records AFTER they come back from the data source.
//
// Dataverse path (primary): sort / filter / search / group / view-column
// selection all run server-side via OData (see odata.ts). The only things that
// cannot be expressed server-side and are handled here — over the already loaded
// page only — are:
//   • custom (cf_*) field filters: custom fields live in localStorage, not
//     Dataverse, so they can never be a $filter clause.
//   • manual drag-reorder.
//   • ordering by a calculated column (dip / totalMfg / totalInstall).
// When none of those apply, the same array reference is returned unchanged.
//
// Airtable path (read-only bridge): has no server query API, so its single
// in-memory dataset is filtered + sorted entirely client-side here.
// ─────────────────────────────────────────────────────────────────────────────

import type { LniRecord } from '../types/schema';
import type { SortCriterion, FilterCondition } from './useGrid';
import { CALC_FIELDS } from '../data/odata';

type GetCustomValue = (id: string, key: string) => unknown;

const SEARCH_KEYS: (keyof LniRecord)[] = ['job', 'status', 'location', 'sales', 'notes'];

function matchFilter(r: LniRecord, cond: FilterCondition, getCustomValue?: GetCustomValue): boolean {
  const raw = cond.field.startsWith('cf_') && getCustomValue
    ? getCustomValue(r.id, cond.field)
    : r[cond.field as keyof LniRecord];
  const val = String(raw ?? '').toLowerCase();
  const target = cond.value.toLowerCase();
  switch (cond.op) {
    case 'contains':     return val.includes(target);
    case 'not_contains': return !val.includes(target);
    case 'is':           return val === target;
    case 'is_not':       return val !== target;
    case 'is_empty':     return val === '';
    case 'is_not_empty': return val !== '';
    default:             return true;
  }
}

function sortBy(records: LniRecord[], keys: SortCriterion[]): LniRecord[] {
  if (keys.length === 0) return records;
  return [...records].sort((a, b) => {
    for (const { field, asc } of keys) {
      const av = a[field as keyof LniRecord] ?? '';
      const bv = b[field as keyof LniRecord] ?? '';
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
    }
    return 0;
  });
}

function applyManualOrder(records: LniRecord[], manualOrder: string[]): LniRecord[] {
  const index = new Map(manualOrder.map((id, i) => [id, i] as const));
  return [...records].sort((a, b) =>
    (index.get(a.id) ?? Infinity) - (index.get(b.id) ?? Infinity)
  );
}

// ── Dataverse path: minimal client-side residue over the loaded page ──────────
export function applyServerPagePostProcess(
  records: LniRecord[],
  sorts: SortCriterion[],
  filters: FilterCondition[],
  manualOrder: string[] | null,
  getCustomValue?: GetCustomValue,
): LniRecord[] {
  let result = records;

  // Custom-field filters can't be sent to Dataverse — apply them here.
  const cfFilters = filters.filter(f => f.field.startsWith('cf_'));
  if (cfFilters.length > 0) {
    result = result.filter(r => cfFilters.every(c => matchFilter(r, c, getCustomValue)));
  }

  if (manualOrder) {
    return applyManualOrder(result, manualOrder);
  }

  // Server already ordered by base columns; only calc-column sorts need fixing up.
  const calcSorts = sorts.filter(s => CALC_FIELDS.has(s.field));
  if (calcSorts.length > 0) {
    return sortBy(result, calcSorts);
  }

  return result;
}

// ── Airtable path: full client-side query over the in-memory dataset ──────────
export function applyClientSideQuery(
  records: LniRecord[],
  searchQuery: string,
  filters: FilterCondition[],
  sorts: SortCriterion[],
  groupField: string | null,
  manualOrder: string[] | null,
  getCustomValue?: GetCustomValue,
): LniRecord[] {
  let result = records;

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter(r => SEARCH_KEYS.some(k => String(r[k] ?? '').toLowerCase().includes(q)));
  }

  for (const cond of filters) {
    result = result.filter(r => matchFilter(r, cond, getCustomValue));
  }

  if (manualOrder) {
    return applyManualOrder(result, manualOrder);
  }

  const orderKeys: SortCriterion[] = [];
  if (groupField) orderKeys.push({ field: groupField, asc: true });
  orderKeys.push(...sorts);
  return sortBy(result, orderKeys);
}
