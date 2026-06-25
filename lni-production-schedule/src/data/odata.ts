// ─────────────────────────────────────────────────────────────────────────────
// OData query builders for Dataverse.
//
// Every sort / filter / search / group / view operation is translated into an
// OData query parameter ($select, $orderby, $filter, $top, $skiptoken) so the
// work happens server-side in Dataverse instead of in JavaScript against the
// full dataset. These are pure, module-level functions — no React, no state.
// ─────────────────────────────────────────────────────────────────────────────

import { FIELD_DEFS } from './fieldDefs';
import type { SortCriterion, FilterCondition } from '../hooks/useGrid';

// Default page size — never load the whole table at once.
export const PAGE_SIZE = 250;

// Calculated columns are derived client-side (see calcFields.ts) and have no
// queryable Dataverse column, so they can never appear in $select/$orderby/$filter.
export const CALC_FIELDS = new Set(['dip', 'totalMfg', 'totalInstall']);

// Source columns required to recompute the calc fields client-side. These are
// always fetched regardless of the active view so dip / totalMfg / totalInstall
// stay correct even when their source columns are not visible.
const CALC_SOURCE_COLS = [
  'lni_order_date',        // dip
  'lni_paint_prep_hrs',    // totalMfg
  'lni_paint_hrs',         // totalMfg
  'lni_steel_hrs',         // totalMfg + totalInstall
  'lni_routing_hrs',       // totalMfg
  'lni_install_hrs',       // totalInstall
  'lni_travel_hrs',        // totalInstall
];

// Primary name column is always needed (primary cell of every view).
const MANDATORY_COLS = ['lni_name'];

// App field key -> Dataverse column. Returns null for things that have no
// server column: custom (cf_*) fields and calculated fields.
export function dvColumn(field: string): string | null {
  if (field.startsWith('cf_')) return null;
  if (CALC_FIELDS.has(field)) return null;
  return FIELD_DEFS[field]?.dvColumn ?? null;
}

// Fields scanned by the global search box.
export const SEARCH_FIELDS = ['job', 'status', 'location', 'sales', 'notes'] as const;

// Escape single quotes for OData string literals.
const esc = (s: string) => s.replace(/'/g, "''");

// Build $select from the columns the active view actually needs (plus the small
// mandatory + calc-source set). Avoids fetching all 60+ columns for every view.
export function buildSelect(viewCols: string[]): string {
  const cols = new Set<string>([...MANDATORY_COLS, ...CALC_SOURCE_COLS]);
  for (const f of viewCols) {
    const c = dvColumn(f);
    if (c) cols.add(c);
  }
  return Array.from(cols).join(',');
}

// Build $orderby. When grouping, the group field is the primary sort key so
// records arrive clustered by group; the grid then renders group headers from
// the already-ordered list (no client-side grouping pass over the full table).
export function buildOrderBy(sorts: SortCriterion[], groupField: string | null): string {
  const parts: string[] = [];
  if (groupField) {
    const c = dvColumn(groupField);
    if (c) parts.push(`${c} asc`);
  }
  for (const s of sorts) {
    const c = dvColumn(s.field);
    if (c) parts.push(`${c} ${s.asc ? 'asc' : 'desc'}`);
  }
  if (parts.length === 0) parts.push('lni_order_date desc'); // stable default
  return parts.join(',');
}

function predicate(col: string, op: FilterCondition['op'], value: string): string | null {
  const v = esc(value);
  switch (op) {
    case 'contains':     return `contains(${col},'${v}')`;
    case 'not_contains': return `not contains(${col},'${v}')`;
    case 'is':           return `${col} eq '${v}'`;
    case 'is_not':       return `${col} ne '${v}'`;
    case 'is_empty':     return `${col} eq null`;
    case 'is_not_empty': return `${col} ne null`;
    default:             return null;
  }
}

// Build $filter from the global search query and the active filter conditions.
// Search becomes a parenthesised OR across the searchable columns; each filter
// condition becomes an AND clause. Custom (cf_*) / calc fields are skipped.
export function buildFilter(searchQuery: string, filters: FilterCondition[]): string {
  const clauses: string[] = [];

  const q = searchQuery.trim();
  if (q) {
    const v = esc(q);
    const ors = SEARCH_FIELDS
      .map(dvColumn)
      .filter((c): c is string => !!c)
      .map(c => `contains(${c},'${v}')`);
    if (ors.length) clauses.push(`(${ors.join(' or ')})`);
  }

  for (const cond of filters) {
    const col = dvColumn(cond.field);
    if (!col) continue;
    const expr = predicate(col, cond.op, cond.value);
    if (expr) clauses.push(expr);
  }

  return clauses.join(' and ');
}

export interface QueryParams {
  viewCols: string[];
  sorts: SortCriterion[];
  filters: FilterCondition[];
  groupField: string | null;
  searchQuery: string;
  top?: number;
  skipToken?: string | null;
}

// Assemble the full OData query string passed to webAPI.retrieveMultipleRecords.
export function buildODataQuery(p: QueryParams): string {
  const params: string[] = [];
  // The group field must be fetched even if it isn't a visible column, so the
  // client can read its value to build group headers.
  const selectCols = p.groupField ? [...p.viewCols, p.groupField] : p.viewCols;
  params.push(`$select=${buildSelect(selectCols)}`);
  params.push(`$orderby=${encodeURIComponent(buildOrderBy(p.sorts, p.groupField))}`);

  const filter = buildFilter(p.searchQuery, p.filters);
  if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);

  params.push(`$top=${p.top ?? PAGE_SIZE}`);
  if (p.skipToken) params.push(`$skiptoken=${encodeURIComponent(p.skipToken)}`);

  return '?' + params.join('&');
}
