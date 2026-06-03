import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import type { LniRecord, CustomFieldDef } from '../../types/schema';
import { FIELD_DEFS, BADGE_FIELDS } from '../../data/fieldDefs';
import { getBadgeColor, COLOR_MAP } from '../../data/statusColors';
import Badge from '../Badge/Badge';
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
}

const isCustom = (field: string) => field.startsWith('cf_');

export default function Grid({ records, visibleCols, groupField, sorts, onToggleSort, onReorder, onPatch, onCreate, customFieldDefs, getCustomValue, onCustomPatch }: Props) {
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [dd, setDd] = useState<DDState | null>(null);
  const [ddSearch, setDdSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const dragId = useRef<string | null>(null);
  activeRef.current = active;

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

  const addRow = async () => {
    await onCreate({
      status: 'New Order this week', process: 'Added', region: 'WK',
      metal: 'X', assembly: 'X', paintPrep: 'X', materialCut: 'X', plex: 'X',
      orderDate: new Date().toISOString().slice(0, 10),
    });
  };

  const toggleGroup = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const colCount = visibleCols.length + 2; // +1 checkbox, +1 drag handle

  const groups: { key: string; rows: LniRecord[] }[] = groupField
    ? Object.entries(
        records.reduce<Record<string, LniRecord[]>>((acc, r) => {
          const k = String(r[groupField as keyof LniRecord] ?? '') || '—';
          (acc[k] ??= []).push(r);
          return acc;
        }, {})
      ).map(([key, rows]) => ({ key, rows }))
    : [{ key: '', rows: records }];

  const handleDragStart = (id: string) => { dragId.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = (targetId: string) => {
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
  };

  return (
    <div className="grid-wrap" onClick={() => { setDd(null); setActive(null); }}>
      <table className="grid-table">
        <colgroup>
          <col style={{ width: 24 }} />
          <col style={{ width: 40 }} />
          {visibleCols.map(f => {
            const w = FIELD_DEFS[f]?.width ?? customFieldDefs.find(d => d.key === f)?.width ?? 120;
            return <col key={f} style={{ width: w }} />;
          })}
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
          {groups.map(({ key, rows }) => (
            <Fragment key={key}>
              {groupField && (
                <tr key={`grp-${key}`} className="grp-header" onClick={() => toggleGroup(key)}>
                  <td colSpan={colCount}>
                    <div className={`grp-header-inner${collapsed.has(key) ? ' collapsed' : ''}`}>
                      <svg viewBox="0 0 10 10" fill="currentColor" width="12" height="12">
                        <path d="M2 3l3 4 3-4z"/>
                      </svg>
                      {key}
                      <span className="grp-count">{rows.length}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!collapsed.has(key) && rows.map(record => (
                <tr
                  key={record.id}
                  className={`grid-row${dragOverId === record.id ? ' drag-over' : ''}`}
                  onDragOver={e => handleDragOver(e, record.id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => handleDrop(record.id)}
                >
                  <td
                    className="drag-handle-td"
                    draggable
                    onDragStart={() => handleDragStart(record.id)}
                    onClick={e => e.stopPropagation()}
                  >
                    ⠿
                  </td>
                  <td className="grid-cb-td" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" />
                  </td>
                  {visibleCols.map((field, ci) => {
                    const custom = isCustom(field);
                    const cdef = custom ? customFieldDefs.find(d => d.key === field) : undefined;
                    const def = custom ? undefined : FIELD_DEFS[field];
                    const isActive = active?.rowId === record.id && active?.field === field;
                    const isPrimary = ci === 0;
                    const isReadonly = def?.type === 'readonly';
                    const classes = [
                      'grid-cell',
                      isPrimary ? 'primary' : '',
                      isActive ? 'editing' : '',
                      isReadonly ? 'readonly' : '',
                    ].filter(Boolean).join(' ');

                    return (
                      <td
                        key={field}
                        className={classes}
                        onClick={e => handleCellClick(e, record.id, field)}
                      >
                        {custom
                          ? isActive
                            ? <CustomCellEditor
                                recordId={record.id} def={cdef}
                                value={getCustomValue(record.id, field)}
                                onCommit={commit} onKey={handleKey}
                              />
                            : <CustomCellDisplay def={cdef} value={getCustomValue(record.id, field)} />
                          : isActive
                            ? <CellEditor record={record} field={field} onCommit={commit} onKey={handleKey} />
                            : <CellDisplay record={record} field={field} />
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
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

// ── CELL DISPLAY ──────────────────────────────────────────────────────────────

function CellDisplay({ record, field }: { record: LniRecord; field: string }) {
  const def = FIELD_DEFS[field];
  const val = record[field as keyof LniRecord];

  if (def?.type === 'readonly') {
    if (field === 'dip') {
      const n = val as number | null;
      if (n == null) return <span style={{ color: 'var(--text3)' }}>—</span>;
      const c = n > 60 ? 'red' : n > 40 ? 'orange' : 'blue';
      const { bg, text } = COLOR_MAP[c];
      return <span className="badge" style={{ background: bg, color: text }}>{n}d</span>;
    }
    if (field === 'totalMfg') {
      const t = (record.paintPrepHrs ?? 0) + (record.paintHrs ?? 0) + (record.steelHrs ?? 0) + (record.routingHrs ?? 0);
      return <span className="badge" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>{t}h</span>;
    }
    if (field === 'totalInstall') {
      const t = (record.steelHrs ?? 0) + (record.installHrs ?? 0) + (record.travelHrs ?? 0);
      return <span className="badge" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>{t}h</span>;
    }
    return <span style={{ color: 'var(--text3)' }}>{String(val ?? '—')}</span>;
  }

  if (val == null || val === '') return <span style={{ color: 'var(--text3)' }}>—</span>;

  if (def?.type === 'bool') {
    return val ? <span style={{ color: 'var(--navy)', fontWeight: 700 }}>✓</span> : null;
  }

  if (def?.type === 'currency') {
    return <span style={{ fontWeight: 600, color: 'var(--navy)' }}>${Number(val).toLocaleString()}</span>;
  }

  if (def?.type === 'number') {
    return <span style={{ fontWeight: 600 }}>{String(val)}</span>;
  }

  if (def?.type === 'date') {
    const s = String(val);
    if (!s) return <span style={{ color: 'var(--text3)' }}>—</span>;
    const dt = new Date(s + 'T00:00:00');
    return <span>{dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>;
  }

  if (BADGE_FIELDS.has(field)) {
    return <Badge field={field} value={String(val)} />;
  }

  const s = String(val);
  return <span title={s}>{s.length > 32 ? s.slice(0, 30) + '…' : s}</span>;
}

// ── CELL EDITOR ───────────────────────────────────────────────────────────────

function CellEditor({
  record, field, onCommit, onKey,
}: {
  record: LniRecord;
  field: string;
  onCommit: (id: string, field: string, val: unknown) => void;
  onKey: (e: React.KeyboardEvent, id: string, field: string, val: () => string) => void;
}) {
  const def = FIELD_DEFS[field];
  const val = record[field as keyof LniRecord];

  if (def?.type === 'bool') {
    return (
      <div className="bool-wrap">
        <input
          type="checkbox"
          checked={Boolean(val)}
          onChange={e => onCommit(record.id, field, e.target.checked)}
          onClick={e => e.stopPropagation()}
        />
      </div>
    );
  }

  if (def?.type === 'select') {
    // Select shows current badge while dropdown is open (dropdown is rendered at portal level)
    return <Badge field={field} value={String(val ?? '')} />;
  }

  if (def?.type === 'multiline') {
    return (
      <textarea
        className="cell-textarea"
        defaultValue={String(val ?? '')}
        autoFocus
        onBlur={e => onCommit(record.id, field, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            onCommit(record.id, field, (e.target as HTMLTextAreaElement).value);
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
        defaultValue={String(val ?? '')}
        autoFocus
        onChange={e => onCommit(record.id, field, e.target.value)}
        onBlur={e => onCommit(record.id, field, e.target.value)}
        onKeyDown={e => onKey(e, record.id, field, () => (e.target as HTMLInputElement).value)}
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
        defaultValue={Number(val ?? 0)}
        autoFocus
        onBlur={e => onCommit(record.id, field, parseFloat(e.target.value) || 0)}
        onKeyDown={e => onKey(e, record.id, field, () => String((e.target as HTMLInputElement).value))}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  // text / fallback
  return (
    <input
      className="cell-input"
      type="text"
      defaultValue={String(val ?? '')}
      autoFocus
      onBlur={e => onCommit(record.id, field, e.target.value)}
      onKeyDown={e => onKey(e, record.id, field, () => (e.target as HTMLInputElement).value)}
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

import { forwardRef } from 'react';

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
