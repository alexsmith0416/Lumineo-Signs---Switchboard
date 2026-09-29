// Search / filter / sort / group for the Jobs grid — pure, ported from the
// Airtable recreation app's useGrid.ts + Grid.tsx group tree.
import type { JobRow } from "../../services/job-tracking";
import { statusTier } from "./jobs-fields";

export interface SortCriterion {
  field: string;
  asc: boolean;
}
export interface GroupCriterion {
  field: string;
  asc: boolean;
}
export type FilterOp =
  | "contains" | "not_contains" | "is" | "is_not" | "is_any_of" | "is_none_of" | "is_empty" | "is_not_empty";
export interface FilterCondition {
  id: string;
  /** How this row joins the previous one (ignored on the first). */
  conjunction: "and" | "or";
  field: string;
  op: FilterOp;
  /** For is_any_of / is_none_of: comma-separated values. */
  value: string;
}
export interface GridPrefs {
  sorts: SortCriterion[];
  filters: FilterCondition[];
  groups: GroupCriterion[];
}

const text = (row: JobRow, field: string): string => {
  const v = (row as unknown as Record<string, unknown>)[field];
  if (typeof v === "boolean") return v ? "yes" : "";
  return v == null ? "" : String(v);
};

export function matchFilter(row: JobRow, f: FilterCondition): boolean {
  const val = text(row, f.field).toLowerCase();
  const target = f.value.toLowerCase();
  const list = (s: string) => s.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  switch (f.op) {
    case "contains": return val.includes(target);
    case "not_contains": return !val.includes(target);
    case "is": return val === target;
    case "is_not": return val !== target;
    case "is_any_of": {
      const allowed = list(f.value);
      // Multi-value cells ("VB, NH") match if any of their values is allowed.
      return allowed.length === 0 || list(val).some((v) => allowed.includes(v));
    }
    case "is_none_of": {
      const banned = list(f.value);
      return banned.length === 0 || !list(val).some((v) => banned.includes(v));
    }
    case "is_empty": return val === "";
    case "is_not_empty": return val !== "";
  }
}

/** Search → filters → sort (status tier first, then the user's sorts). */
export function applyGrid(rows: readonly JobRow[], search: string, prefs: GridPrefs): JobRow[] {
  let out = rows as JobRow[];
  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter((r) =>
      [r.job, r.status, r.location, r.sales, r.notes, r.description].some((s) => s.toLowerCase().includes(q)),
    );
  }
  if (prefs.filters.length) {
    out = out.filter((r) =>
      prefs.filters.reduce<boolean>((pass, f, i) => {
        const m = matchFilter(r, f);
        return i === 0 ? m : f.conjunction === "or" ? pass || m : pass && m;
      }, true),
    );
  }
  return [...out].sort((a, b) => {
    for (const { field, asc } of prefs.sorts) {
      const c = compare(a, b, field);
      if (c) return asc ? c : -c;
    }
    const t = statusTier(a.status) - statusTier(b.status);
    return t || a.jobNo.localeCompare(b.jobNo);
  });
}

function compare(a: JobRow, b: JobRow, field: string): number {
  const av = (a as unknown as Record<string, unknown>)[field];
  const bv = (b as unknown as Record<string, unknown>)[field];
  if (typeof av === "number" || typeof bv === "number") {
    // A blank number sorts below every value.
    return (typeof av === "number" ? av : -Infinity) - (typeof bv === "number" ? bv : -Infinity);
  }
  return text(a, field).localeCompare(text(b, field), undefined, { numeric: true });
}

// ── Group tree ───────────────────────────────────────────────────────────────
export interface GroupNode {
  key: string;
  path: string;
  depth: number;
  field: string;
  rows: JobRow[];
  children: GroupNode[];
  count: number;
}

export function buildGroupTree(rows: JobRow[], groups: GroupCriterion[], depth = 0, parent = ""): GroupNode[] {
  if (!groups.length) return [];
  const [first, ...rest] = groups;
  const buckets = new Map<string, JobRow[]>();
  for (const r of rows) {
    const k = text(r, first!.field) || "—";
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(r);
  }
  const keys = [...buckets.keys()].sort((a, b) =>
    first!.field === "status" ? statusTier(a) - statusTier(b) || a.localeCompare(b) : a.localeCompare(b, undefined, { numeric: true }),
  );
  if (!first!.asc) keys.reverse();
  return keys.map((key) => {
    const bucket = buckets.get(key)!;
    const path = parent ? `${parent}\u0000${key}` : key;
    return {
      key, path, depth, field: first!.field, count: bucket.length,
      rows: rest.length ? [] : bucket,
      children: rest.length ? buildGroupTree(bucket, rest, depth + 1, path) : [],
    };
  });
}

export type FlatItem = { kind: "header"; node: GroupNode } | { kind: "row"; row: JobRow };

export function flattenTree(nodes: GroupNode[], collapsed: ReadonlySet<string>): FlatItem[] {
  const out: FlatItem[] = [];
  for (const node of nodes) {
    out.push({ kind: "header", node });
    if (collapsed.has(node.path)) continue;
    out.push(...flattenTree(node.children, collapsed));
    for (const row of node.rows) out.push({ kind: "row", row });
  }
  return out;
}

export function allGroupPaths(nodes: GroupNode[]): string[] {
  return nodes.flatMap((n) => [n.path, ...allGroupPaths(n.children)]);
}
