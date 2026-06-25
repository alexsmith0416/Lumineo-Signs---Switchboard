// ─────────────────────────────────────────────────────────────────────────────
// A tiny OData query engine used by the local-dev Power Apps mock to emulate how
// Dataverse applies $select / $orderby / $filter / $top / $skiptoken server-side.
// Pure (no React, no window) so it can be unit-tested in isolation.
//
// It only needs to understand the subset of OData that odata.ts emits:
//   contains(col,'v') | not contains(col,'v') | col eq 'v' | col ne 'v'
//   col eq null | col ne null   — joined by ' and ', OR-groups in parens.
// ─────────────────────────────────────────────────────────────────────────────

export type Entity = Record<string, unknown>;

export interface QueryResult {
  entities: Entity[];
  '@odata.nextLink'?: string;
}

// Split on a separator at the top level only (outside quotes and parentheses).
export function splitTop(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0, inStr = false, buf = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      buf += ch;
      if (ch === "'") {
        if (s[i + 1] === "'") { buf += "'"; i++; } // escaped quote
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") { inStr = true; buf += ch; continue; }
    if (ch === '(') { depth++; buf += ch; continue; }
    if (ch === ')') { depth--; buf += ch; continue; }
    if (depth === 0 && s.startsWith(sep, i)) { parts.push(buf); buf = ''; i += sep.length - 1; continue; }
    buf += ch;
  }
  parts.push(buf);
  return parts;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

function evalPredicate(pred: string, e: Entity): boolean {
  let p = pred.trim();
  let neg = false;
  if (p.startsWith('not ')) { neg = true; p = p.slice(4).trim(); }

  if (p.startsWith('contains(')) {
    const inner = p.slice('contains('.length, p.lastIndexOf(')'));
    const ci = inner.indexOf(',');
    const col = inner.slice(0, ci).trim();
    const val = unquote(inner.slice(ci + 1)).toLowerCase();
    const cell = String(e[col] ?? '').toLowerCase();
    const res = cell.includes(val);
    return neg ? !res : res;
  }

  const m = p.match(/^(\S+)\s+(eq|ne)\s+(.+)$/);
  if (m) {
    const [, col, op, rhsRaw] = m;
    const cell = e[col];
    if (rhsRaw.trim() === 'null') {
      const isEmpty = cell == null || cell === '';
      return op === 'eq' ? isEmpty : !isEmpty;
    }
    const val = unquote(rhsRaw).toLowerCase();
    const eq = String(cell ?? '').toLowerCase() === val;
    return op === 'eq' ? eq : !eq;
  }

  return true;
}

function evalClause(clause: string, e: Entity): boolean {
  const c = clause.trim();
  if (c.startsWith('(') && c.endsWith(')')) {
    return splitTop(c.slice(1, -1), ' or ').some(p => evalPredicate(p, e));
  }
  return evalPredicate(c, e);
}

export function evalFilter(filter: string, e: Entity): boolean {
  return splitTop(filter, ' and ').every(c => evalClause(c, e));
}

interface OrderKey { col: string; desc: boolean }

function parseOrderBy(orderby: string): OrderKey[] {
  return orderby.split(',').map(part => {
    const [col, dir] = part.trim().split(/\s+/);
    return { col, desc: (dir ?? 'asc').toLowerCase() === 'desc' };
  }).filter(k => k.col);
}

function compareBy(keys: OrderKey[], a: Entity, b: Entity): number {
  for (const { col, desc } of keys) {
    const av = (a[col] ?? '') as string | number;
    const bv = (b[col] ?? '') as string | number;
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
  }
  return 0;
}

function project(e: Entity, select: string[] | null, primaryKey: string): Entity {
  if (!select) return e;
  const out: Entity = { [primaryKey]: e[primaryKey] };
  for (const col of select) out[col] = e[col];
  return out;
}

// Apply a full OData query string to an in-memory list of entities.
export function runODataQuery(entities: Entity[], query: string, primaryKey: string): QueryResult {
  const qs = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const select = qs.get('$select')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
  const orderby = qs.get('$orderby');
  const filter = qs.get('$filter');
  const top = parseInt(qs.get('$top') ?? '250', 10) || 250;
  const skipToken = qs.get('$skiptoken'); // e.g. "offset=250"
  const offset = skipToken ? (parseInt(skipToken.replace(/^offset=/, ''), 10) || 0) : 0;

  let rows = entities;
  if (filter) rows = rows.filter(e => evalFilter(filter, e));
  if (orderby) {
    const keys = parseOrderBy(orderby);
    rows = [...rows].sort((a, b) => compareBy(keys, a, b));
  }

  const total = rows.length;
  const page = rows.slice(offset, offset + top).map(e => project(e, select, primaryKey));
  const nextOffset = offset + top;
  const result: QueryResult = { entities: page };
  if (nextOffset < total) {
    result['@odata.nextLink'] = `?$skiptoken=${encodeURIComponent(`offset=${nextOffset}`)}`;
  }
  return result;
}
