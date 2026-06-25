import { useState, useCallback, useEffect, useRef, useMemo, memo, forwardRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LniRecord, CustomFieldDef } from '../../types/schema';
import { FIELD_DEFS, BADGE_FIELDS } from '../../data/fieldDefs';
import { getBadgeColor, COLOR_MAP } from '../../data/statusColors';
import Badge from '../Badge/Badge';
import { ErrorBoundary } from './ErrorBoundary';
import type { SortCriterion } from '../../hooks/useGrid';

interface ActiveCell { rowId: string; field: string }
interface DDState { rowId: string; field: string; rect: DOMRect }

interface Props {
  records: LniRecord[];
  visibleCols: string[];
  groupField: string | null;
  sorts: SortCriterion[];
  onToggleSort: (field: string) => void;
  manualOrder: string[] | null;
  onReorder: (newIds: string[]) => void;
  onPatch: (id: string, field: string, value: unknown) => void;
  onCreate: (defaults: Partial<Record<string, unknown>>) => Promise<string>;
  customFieldDefs: CustomFieldDef[];
  getCustomValue: (recordId: string, fieldKey: string) => unknown;
  onCustomPatch: (recordId: string, fieldKey: string, value: unknown) => void;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  cellErrors: Set<string>;
}

// ── Module-level constants (never recreated per render) ───────────────────────
const ROW_H = 40;            // matches --row-h
const GROUP_H = 33;          // group-header row
const OVERSCAN = 5;          // rows rendered beyond the viewport
const SKELETON_ROWS = 14;    // skeleton placeholders during initial load
const LOAD_MORE_THRESHOLD = 12; // fetch next page this many rows from the end

const isCustom = (field: string) => field.startsWith('cf_');
const stop = (e: React.MouseEvent) => e.stopPropagation();

function colWidth(field: string, customFieldDefs: CustomFieldDef[]): number {
  return FIELD_DEFS[field]?.width ?? customFieldDefs.find(d => d.key === field)?.width ?? 120;
}

// Flattened virtual-list item: either a group header or a data row.
type GridItem =
  | { kind: 'group'; key: string; count: number }
  | { kind: 'row'; record: LniRecord };

export default function Grid({
  records, visibleCols, groupField, sorts, onToggleSort, onReorder,
  onPatch, onCreate, customFieldDefs, getCustomValue, onCustomPatch,
  loading, hasMore, loadingMore, onLoadMore, cellErrors,
}: Props) {
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [dd, setDd] = useState<DDState | null>(null);
  const [ddSearch, setDdSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);

  // Close dropdown + deactivate cell on outside click
  useEffect(() => {
    const handler = () => { setDd(null); setActive(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const activateCell = useCallback((rowId: string, field: string) => {
    setActive({ rowId, field });
  }, []);

  const commit = useCallback((rowId: string, field: string, value: unknown) => {
    if (isCustom(field)) onCustomPatch(rowId, field, value);
    else onPatch(rowId, field, value);
    setActive(null);
    setDd(null);
  }, [onPatch, onCustomPatch]);

  const handleCellClick = useCallback((e: React.MouseEvent, rowId: string, field: string) => {
    e.stopPropagation();
    setDd(null);

    if (isCustom(field)) {
      const cdef = customFieldDefs.find(d => d.key === field);
      if (!cdef) return;
      if (cdef.type === 'formula-date') return; // read-only
      if (cdef.type === 'bool') {
        onCustomPatch(rowId, field, !getCustomValue(rowId, field));
        return;
      }
      activateCell(rowId, field);
      return;
    }

    const def = FIELD_DEFS[field];
    if (!def || def.type === 'readonly') return;

    if (def.type === 'bool') {
      const rec = records.find(r => r.id === rowId);
      if (rec) commit(rowId, field, !rec[field as keyof LniRecord]);
      return;
    }

    if (def.type === 'select') {
      activateCell(rowId, field);
      // Reading layout here is fine — this is an event handler, not render.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDdSearch('');
      setTimeout(() => setDd({ rowId, field, rect }), 0);
      return;
    }

    activateCell(rowId, field);
  }, [records, customFieldDefs, getCustomValue, onCustomPatch, commit, activateCell]);

  const handleKey = useCallback((e: React.KeyboardEvent, rowId: string, field: string, value: () => string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commit(rowId, field, value());
      if (e.key === 'Tab') {
        const idx = visibleCols.indexOf(field);
        if (idx < visibleCols.length - 1) {
          setTimeout(() => activateCell(rowId, visibleCols[idx + 1]), 20);
        }
      }
    }
    if (e.key === 'Escape') { setActive(null); setDd(null); }
  }, [commit, visibleCols, activateCell]);

  const addRow = useCallback(async () => {
    await onCreate({
      status: 'New Order this week', process: 'Added', region: 'WK',
      metal: 'X', assembly: 'X', paintPrep: 'X', materialCut: 'X', plex: 'X',
      orderDate: new Date().toISOString().slice(0, 10),
    });
  }, [onCreate]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((id: string) => { dragId.current = id; }, []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);
  const handleDragLeave = useCallback(() => setDragOverId(null), []);
  const handleDrop = useCallback((targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!from || from === targetId) return;
    const ids = records.map(r => r.id);
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from);
    onReorder(next);
  }, [records, onReorder]);

  const colCount = visibleCols.length + 2; // +1 checkbox, +1 drag handle

  // Group the (server-ordered) records, then flatten into a single virtual list.
  // Collapsing a group only drops its rows from `items` — it never re-renders the
  // rows of other groups (they keep the same memoized identity).
  const groups = useMemo(() => {
    if (!groupField) return [{ key: '', rows: records }];
    const m = new Map<string, LniRecord[]>();
    for (const r of records) {
      const k = String(r[groupField as keyof LniRecord] ?? '') || '—';
      const bucket = m.get(k);
      if (bucket) bucket.push(r); else m.set(k, [r]);
    }
    return Array.from(m, ([key, rows]) => ({ key, rows }));
  }, [records, groupField]);

  const items = useMemo<GridItem[]>(() => {
    const out: GridItem[] = [];
    for (const g of groups) {
      if (groupField) out.push({ kind: 'group', key: g.key, count: g.rows.length });
      if (!collapsed.has(g.key)) {
        for (const record of g.rows) out.push({ kind: 'row', record });
      }
    }
    return out;
  }, [groups, collapsed, groupField]);

  const getItemKey = useCallback(
    (index: number) => {
      const it = items[index];
      return it.kind === 'group' ? `g:${it.key}` : `r:${it.record.id}`;
    },
    [items],
  );

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i]?.kind === 'group' ? GROUP_H : ROW_H),
    overscan: OVERSCAN,
    getItemKey,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Infinite scroll: fetch the next page when nearing the end of what's loaded.
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= items.length - LOAD_MORE_THRESHOLD && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [virtualItems, items.length, hasMore, loadingMore, onLoadMore]);

  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  // Per-row error fields, as a stable primitive so only affected rows re-render.
  const errorFieldsFor = useCallback((id: string): string | undefined => {
    if (cellErrors.size === 0) return undefined;
    const fields: string[] = [];
    for (const key of cellErrors) {
      if (key.startsWith(id + ':')) fields.push(key.slice(id.length + 1));
    }
    return fields.length ? fields.join(',') : undefined;
  }, [cellErrors]);

  const measureRef = rowVirtualizer.measureElement;
  const showEmpty = !loading && items.length === 0;

  return (
    <div className="grid-wrap" ref={parentRef} onClick={() => { setDd(null); setActive(null); }}>
      <table className="grid-table">
        <colgroup>
          <col style={{ width: 24 }} />
          <col style={{ width: 40 }} />
          {visibleCols.map(f => <col key={f} style={{ width: colWidth(f, customFieldDefs) }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="drag-handle-th" />
            <th className="col-cb-th">
              <input type="checkbox" />
            </th>
            {visibleCols.map(f => {
              const def = FIELD_DEFS[f];
              const cdef = isCustom(f) ? customFieldDefs.find(d => d.key === f) : undefined;
              const label = def?.label ?? cdef?.label ?? f;
              const sortIdx = sorts.findIndex(s => s.field === f);
              const isSorted = sortIdx !== -1;
              const isAsc = isSorted ? sorts[sortIdx].asc : true;
              return (
                <th key={f} className="col-th" onClick={() => onToggleSort(f)}>
                  <div className="col-th-inner">
                    {cdef && <span className="col-custom-icon">{
                      ['text','url','email','phone'].includes(cdef.type) ? 'Aa' :
                      cdef.type === 'multiline' ? '¶' :
                      cdef.type === 'number' ? '#' :
                      cdef.type === 'currency' ? '$' :
                      cdef.type === 'date' ? '⬚' :
                      cdef.type === 'bool' ? '☑' :
                      cdef.type === 'select' ? '▼' :
                      cdef.type === 'formula-date' ? 'f()' : 'Aa'
                    }</span>}
                    {label}
                    {sorts.length > 1 && isSorted && (
                      <span className="sort-num">{sortIdx + 1}</span>
                    )}
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                      style={{ opacity: isSorted ? 0.9 : 0.35, marginLeft: 'auto' }}>
                      {isSorted && isAsc
                        ? <path d="M2 7l3-4 3 4"/>
                        : isSorted
                          ? <path d="M2 3l3 4 3-4"/>
                          : <path d="M2 3l3-2 3 2M2 7l3 2 3-2"/>}
                    </svg>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <SkeletonRow key={`sk-${i}`} visibleCols={visibleCols} />
          ))}

          {showEmpty && (
            <tr>
              <td colSpan={colCount}>
                <div className="grid-empty">No records in this view</div>
              </td>
            </tr>
          )}

          {!loading && !showEmpty && (
            <>
              {paddingTop > 0 && (
                <tr aria-hidden style={{ height: paddingTop }}><td colSpan={colCount} style={{ padding: 0, border: 0 }} /></tr>
              )}

              {virtualItems.map(vi => {
                const it = items[vi.index];
                if (it.kind === 'group') {
                  return (
                    <GroupHeaderRow
                      key={vi.key}
                      groupKey={it.key}
                      count={it.count}
                      collapsed={collapsed.has(it.key)}
                      onToggle={toggleGroup}
                      colCount={colCount}
                      dataIndex={vi.index}
                      measureRef={measureRef}
                    />
                  );
                }
                const record = it.record;
                const activeField = active?.rowId === record.id ? active.field : null;
                return (
                  <Row
                    key={vi.key}
                    record={record}
                    visibleCols={visibleCols}
                    customFieldDefs={customFieldDefs}
                    activeField={activeField}
                    isDragOver={dragOverId === record.id}
                    errorFields={errorFieldsFor(record.id)}
                    getCustomValue={getCustomValue}
                    onCellClick={handleCellClick}
                    onCommit={commit}
                    onKey={handleKey}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    colCount={colCount}
                    dataIndex={vi.index}
                    measureRef={measureRef}
                  />
                );
              })}

              {paddingBottom > 0 && (
                <tr aria-hidden style={{ height: paddingBottom }}><td colSpan={colCount} style={{ padding: 0, border: 0 }} /></tr>
              )}

              {loadingMore && (
                <tr><td colSpan={colCount}><div className="grid-loading-more">Loading more…</div></td></tr>
              )}

              <tr className="add-row" onClick={addRow}>
                <td colSpan={colCount}>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                      <path d="M6.5 1v11M1 6.5h11"/>
                    </svg>
                    Add record…
                  </span>
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Custom dropdown portal */}
      {dd && (
        <SelectDropdown
          ref={ddRef}
          rowId={dd.rowId}
          field={dd.field}
          rect={dd.rect}
          currentValue={String((records.find(r => r.id === dd.rowId) ?? {})[dd.field as keyof LniRecord] ?? '')}
          search={ddSearch}
          onSearch={setDdSearch}
          onPick={(val) => { commit(dd.rowId, dd.field, val); }}
          onClose={() => setDd(null)}
        />
      )}
    </div>
  );
}

// ── ROW ───────────────────────────────────────────────────────────────────────

interface RowProps {
  record: LniRecord;
  visibleCols: string[];
  customFieldDefs: CustomFieldDef[];
  activeField: string | null;
  isDragOver: boolean;
  errorFields: string | undefined;
  getCustomValue: (recordId: string, fieldKey: string) => unknown;
  onCellClick: (e: React.MouseEvent, rowId: string, field: string) => void;
  onCommit: (id: string, field: string, value: unknown) => void;
  onKey: (e: React.KeyboardEvent, id: string, field: string, value: () => string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (id: string) => void;
  colCount: number;
  dataIndex: number;
  measureRef: (el: HTMLElement | null) => void;
}

const Row = memo(function Row({
  record, visibleCols, customFieldDefs, activeField, isDragOver, errorFields,
  getCustomValue, onCellClick, onCommit, onKey,
  onDragStart, onDragOver, onDragLeave, onDrop, colCount, dataIndex, measureRef,
}: RowProps) {
  const errSet = errorFields ? errorFields.split(',') : null;
  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      className={`grid-row${isDragOver ? ' drag-over' : ''}`}
      onDragOver={e => onDragOver(e, record.id)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(record.id)}
    >
      <ErrorBoundary fallback={<td colSpan={colCount} className="row-error">⚠ This row failed to render</td>}>
        <td className="drag-handle-td" draggable onDragStart={() => onDragStart(record.id)} onClick={stop}>⠿</td>
        <td className="grid-cb-td" onClick={stop}><input type="checkbox" /></td>
        {visibleCols.map((field, ci) => {
          const custom = isCustom(field);
          const cdef = custom ? customFieldDefs.find(d => d.key === field) : undefined;
          const value = custom ? getCustomValue(record.id, field) : record[field as keyof LniRecord];
          return (
            <Cell
              key={field}
              recordId={record.id}
              field={field}
              value={value}
              custom={custom}
              cdef={cdef}
              isActive={activeField === field}
              isPrimary={ci === 0}
              hasError={errSet?.includes(field) ?? false}
              onCellClick={onCellClick}
              onCommit={onCommit}
              onKey={onKey}
            />
          );
        })}
      </ErrorBoundary>
    </tr>
  );
});

// ── GROUP HEADER ROW ────────────────────────────────────────────────────────

interface GroupHeaderProps {
  groupKey: string;
  count: number;
  collapsed: boolean;
  onToggle: (key: string) => void;
  colCount: number;
  dataIndex: number;
  measureRef: (el: HTMLElement | null) => void;
}

const GroupHeaderRow = memo(function GroupHeaderRow({
  groupKey, count, collapsed, onToggle, colCount, dataIndex, measureRef,
}: GroupHeaderProps) {
  return (
    <tr ref={measureRef} data-index={dataIndex} className="grp-header" onClick={() => onToggle(groupKey)}>
      <td colSpan={colCount}>
        <div className={`grp-header-inner${collapsed ? ' collapsed' : ''}`}>
          <svg viewBox="0 0 10 10" fill="currentColor" width="12" height="12">
            <path d="M2 3l3 4 3-4z"/>
          </svg>
          {groupKey}
          <span className="grp-count">{count}</span>
        </div>
      </td>
    </tr>
  );
});

// ── SKELETON ROW ──────────────────────────────────────────────────────────────

const SkeletonRow = memo(function SkeletonRow({ visibleCols }: { visibleCols: string[] }) {
  return (
    <tr className="grid-row skeleton-row">
      <td className="drag-handle-td" />
      <td className="grid-cb-td" />
      {visibleCols.map(f => (
        <td key={f} className="grid-cell"><span className="skel-bar" /></td>
      ))}
    </tr>
  );
});

// ── CELL ────────────────────────────────────────────────────────────────────

interface CellProps {
  recordId: string;
  field: string;
  value: unknown;
  custom: boolean;
  cdef: CustomFieldDef | undefined;
  isActive: boolean;
  isPrimary: boolean;
  hasError: boolean;
  onCellClick: (e: React.MouseEvent, rowId: string, field: string) => void;
  onCommit: (id: string, field: string, value: unknown) => void;
  onKey: (e: React.KeyboardEvent, id: string, field: string, value: () => string) => void;
}

const Cell = memo(function Cell({
  recordId, field, value, custom, cdef, isActive, isPrimary, hasError, onCellClick, onCommit, onKey,
}: CellProps) {
  const def = custom ? undefined : FIELD_DEFS[field];
  const isReadonly = def?.type === 'readonly';
  const classes = [
    'grid-cell',
    isPrimary ? 'primary' : '',
    isActive ? 'editing' : '',
    isReadonly ? 'readonly' : '',
    hasError ? 'cell-error' : '',
  ].filter(Boolean).join(' ');

  return (
    <td className={classes} onClick={e => onCellClick(e, recordId, field)}>
      {custom
        ? isActive
          ? <CustomCellEditor recordId={recordId} def={cdef} value={value} onCommit={onCommit} onKey={onKey} />
          : <CustomCellDisplay def={cdef} value={value} />
        : isActive
          ? <CellEditor recordId={recordId} field={field} value={value} onCommit={onCommit} onKey={onKey} />
          : <CellDisplay field={field} value={value} />
      }
      {hasError && <span className="cell-error-dot" title="Save failed — value reverted">!</span>}
    </td>
  );
});

// ── CELL DISPLAY ──────────────────────────────────────────────────────────────

function CellDisplay({ field, value }: { field: string; value: unknown }) {
  const def = FIELD_DEFS[field];

  if (def?.type === 'readonly') {
    if (field === 'dip') {
      const n = value as number | null;
      if (n == null) return <span style={{ color: 'var(--text3)' }}>—</span>;
      const c = n > 60 ? 'red' : n > 40 ? 'orange' : 'blue';
      const { bg, text } = COLOR_MAP[c];
      return <span className="badge" style={{ background: bg, color: text }}>{n}d</span>;
    }
    if (field === 'totalMfg') {
      const t = (value as number | null) ?? 0;
      return <span className="badge" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>{t}h</span>;
    }
    if (field === 'totalInstall') {
      const t = (value as number | null) ?? 0;
      return <span className="badge" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>{t}h</span>;
    }
    return <span style={{ color: 'var(--text3)' }}>{String(value ?? '—')}</span>;
  }

  if (value == null || value === '') return <span style={{ color: 'var(--text3)' }}>—</span>;

  if (def?.type === 'bool') {
    return value ? <span style={{ color: 'var(--navy)', fontWeight: 700 }}>✓</span> : null;
  }

  if (def?.type === 'currency') {
    return <span style={{ fontWeight: 600, color: 'var(--navy)' }}>${Number(value).toLocaleString()}</span>;
  }

  if (def?.type === 'number') {
    return <span style={{ fontWeight: 600 }}>{String(value)}</span>;
  }

  if (def?.type === 'date') {
    const s = String(value);
    if (!s) return <span style={{ color: 'var(--text3)' }}>—</span>;
    const dt = new Date(s + 'T00:00:00');
    return <span>{dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>;
  }

  if (BADGE_FIELDS.has(field)) {
    return <Badge field={field} value={String(value)} />;
  }

  const s = String(value);
  return <span title={s}>{s.length > 32 ? s.slice(0, 30) + '…' : s}</span>;
}

// ── CELL EDITOR ───────────────────────────────────────────────────────────────

function CellEditor({
  recordId, field, value, onCommit, onKey,
}: {
  recordId: string;
  field: string;
  value: unknown;
  onCommit: (id: string, field: string, val: unknown) => void;
  onKey: (e: React.KeyboardEvent, id: string, field: string, val: () => string) => void;
}) {
  const def = FIELD_DEFS[field];

  if (def?.type === 'bool') {
    return (
      <div className="bool-wrap">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onCommit(recordId, field, e.target.checked)}
          onClick={e => e.stopPropagation()}
        />
      </div>
    );
  }

  if (def?.type === 'select') {
    // Select shows current badge while dropdown is open (dropdown is rendered at portal level)
    return <Badge field={field} value={String(value ?? '')} />;
  }

  if (def?.type === 'multiline') {
    return (
      <textarea
        className="cell-textarea"
        defaultValue={String(value ?? '')}
        autoFocus
        onBlur={e => onCommit(recordId, field, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            onCommit(recordId, field, (e.target as HTMLTextAreaElement).value);
          }
        }}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  if (def?.type === 'date') {
    return (
      <input
        className="cell-input"
        type="date"
        defaultValue={String(value ?? '')}
        autoFocus
        onChange={e => onCommit(recordId, field, e.target.value)}
        onBlur={e => onCommit(recordId, field, e.target.value)}
        onKeyDown={e => onKey(e, recordId, field, () => (e.target as HTMLInputElement).value)}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  if (def?.type === 'number' || def?.type === 'currency') {
    return (
      <input
        className="cell-input num"
        type="number"
        step={def.type === 'currency' ? '0.01' : '1'}
        defaultValue={Number(value ?? 0)}
        autoFocus
        onBlur={e => onCommit(recordId, field, parseFloat(e.target.value) || 0)}
        onKeyDown={e => onKey(e, recordId, field, () => String((e.target as HTMLInputElement).value))}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  // text / fallback
  return (
    <input
      className="cell-input"
      type="text"
      defaultValue={String(value ?? '')}
      autoFocus
      onBlur={e => onCommit(recordId, field, e.target.value)}
      onKeyDown={e => onKey(e, recordId, field, () => (e.target as HTMLInputElement).value)}
      onClick={e => e.stopPropagation()}
    />
  );
}

// ── CUSTOM CELL DISPLAY ───────────────────────────────────────────────────────

function CustomCellDisplay({ def, value }: { def: CustomFieldDef | undefined; value: unknown }) {
  if (!def) return null;
  if (value == null || value === '') return <span style={{ color: 'var(--text3)' }}>—</span>;

  switch (def.type) {
    case 'bool':
      return value ? <span style={{ color: 'var(--navy)', fontWeight: 700 }}>✓</span> : null;
    case 'currency':
      return <span style={{ fontWeight: 600, color: 'var(--navy)' }}>${Number(value).toLocaleString()}</span>;
    case 'number':
      return <span style={{ fontWeight: 600 }}>{String(value)}</span>;
    case 'date':
    case 'formula-date': {
      const s = String(value);
      const dt = new Date(s + 'T00:00:00');
      return <span>{dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>;
    }
    case 'url':
      return <a href={String(value)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
        style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{String(value)}</a>;
    case 'email':
      return <a href={`mailto:${value}`} onClick={e => e.stopPropagation()}
        style={{ color: 'var(--blue)' }}>{String(value)}</a>;
    case 'phone':
      return <a href={`tel:${value}`} onClick={e => e.stopPropagation()}
        style={{ color: 'var(--text)' }}>{String(value)}</a>;
    case 'select': {
      const s = String(value);
      return <span className="badge" style={{ background: 'var(--bg2)', color: 'var(--navy)', border: '1px solid var(--border)' }}>{s}</span>;
    }
    default: {
      const s = String(value);
      return <span title={s}>{s.length > 32 ? s.slice(0, 30) + '…' : s}</span>;
    }
  }
}

// ── CUSTOM CELL EDITOR ────────────────────────────────────────────────────────

function CustomCellEditor({
  recordId, def, value, onCommit, onKey,
}: {
  recordId: string;
  def: CustomFieldDef | undefined;
  value: unknown;
  onCommit: (id: string, field: string, val: unknown) => void;
  onKey: (e: React.KeyboardEvent, id: string, field: string, val: () => string) => void;
}) {
  if (!def) return null;
  const field = def.key;

  if (def.type === 'bool') {
    return (
      <div className="bool-wrap">
        <input type="checkbox" checked={Boolean(value)}
          onChange={e => onCommit(recordId, field, e.target.checked)}
          onClick={e => e.stopPropagation()} />
      </div>
    );
  }

  if (def.type === 'multiline') {
    return (
      <textarea className="cell-textarea" defaultValue={String(value ?? '')} autoFocus
        onBlur={e => onCommit(recordId, field, e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); onCommit(recordId, field, (e.target as HTMLTextAreaElement).value); } }}
        onClick={e => e.stopPropagation()} />
    );
  }

  if (def.type === 'date') {
    return (
      <input className="cell-input" type="date" defaultValue={String(value ?? '')} autoFocus
        onChange={e => onCommit(recordId, field, e.target.value)}
        onBlur={e => onCommit(recordId, field, e.target.value)}
        onKeyDown={e => onKey(e, recordId, field, () => (e.target as HTMLInputElement).value)}
        onClick={e => e.stopPropagation()} />
    );
  }

  if (def.type === 'number' || def.type === 'currency') {
    return (
      <input className="cell-input num" type="number" step={def.type === 'currency' ? '0.01' : '1'}
        defaultValue={Number(value ?? 0)} autoFocus
        onBlur={e => onCommit(recordId, field, parseFloat(e.target.value) || 0)}
        onKeyDown={e => onKey(e, recordId, field, () => String((e.target as HTMLInputElement).value))}
        onClick={e => e.stopPropagation()} />
    );
  }

  if (def.type === 'select' && def.opts && def.opts.length > 0) {
    return (
      <select className="cell-input" defaultValue={String(value ?? '')} autoFocus
        onChange={e => onCommit(recordId, field, e.target.value)}
        onClick={e => e.stopPropagation()}>
        <option value="">—</option>
        {def.opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  // text, url, email, phone
  return (
    <input className="cell-input"
      type={def.type === 'email' ? 'email' : def.type === 'url' ? 'url' : 'text'}
      defaultValue={String(value ?? '')} autoFocus
      onBlur={e => onCommit(recordId, field, e.target.value)}
      onKeyDown={e => onKey(e, recordId, field, () => (e.target as HTMLInputElement).value)}
      onClick={e => e.stopPropagation()} />
  );
}

// ── SELECT DROPDOWN ───────────────────────────────────────────────────────────

const SelectDropdown = forwardRef<HTMLDivElement, {
  rowId: string; field: string; rect: DOMRect;
  currentValue: string; search: string;
  onSearch: (q: string) => void;
  onPick: (val: string) => void;
  onClose: () => void;
}>(function SelectDropdown({ field, rect, currentValue, search, onSearch, onPick, onClose }, ref) {
  const def = FIELD_DEFS[field];
  const opts = def?.opts ?? [];
  const filtered = opts.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const style: React.CSSProperties = {
    top: rect.bottom + 2,
    left: rect.left,
    minWidth: Math.max(rect.width, 200),
  };

  return (
    <div
      ref={ref}
      className="cdd"
      style={style}
      onClick={e => e.stopPropagation()}
    >
      <div className="cdd-search">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          autoFocus
          onChange={e => onSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
      </div>
      <div>
        {filtered.length === 0 && <div className="cdd-empty">No match</div>}
        {filtered.map(opt => {
          const c = getBadgeColor(field, opt);
          const { bg, text } = COLOR_MAP[c];
          return (
            <div
              key={opt}
              className={`cdd-item${opt === currentValue ? ' sel' : ''}`}
              onClick={() => onPick(opt)}
            >
              <span className="badge" style={{ background: bg, color: text }}>{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
