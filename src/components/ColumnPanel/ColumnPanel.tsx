import { useState, useRef } from 'react';
import { FIELD_DEFS } from '../../data/fieldDefs';
import { VIEW_COLS } from '../../data/viewConfigs';
import type { CustomFieldDef } from '../../types/schema';

interface Props {
  viewName: string;
  visibleCols: string[];
  customFieldDefs: CustomFieldDef[];
  onClose: () => void;
  onSave: (hidden: string[], order: string[]) => void;
}

export default function ColumnPanel({ viewName, visibleCols, customFieldDefs, onClose, onSave }: Props) {
  const baseCols = VIEW_COLS[viewName] ?? [];
  const customKeys = customFieldDefs.map(d => d.key).filter(k => !baseCols.includes(k));
  const allCols = [...baseCols, ...customKeys];

  // Order tracks the full list; hidden tracks which are toggled off
  const [order, setOrder] = useState<string[]>(allCols);
  const [hidden, setHidden] = useState<Set<string>>(
    new Set(allCols.filter(k => !visibleCols.includes(k)))
  );
  const [search, setSearch] = useState('');

  const dragKey = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  const toggle = (key: string, on: boolean) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (on) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleDragStart = (key: string) => { dragKey.current = key; };
  const handleDragEnter = (key: string) => { dragOver.current = key; };

  const handleDrop = () => {
    const from = dragKey.current;
    const to = dragOver.current;
    if (!from || !to || from === to) return;
    setOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(to);
      if (fi === -1 || ti === -1) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragKey.current = null;
    dragOver.current = null;
  };

  const handleDone = () => {
    onSave(Array.from(hidden), order);
  };

  const getLabel = (key: string) =>
    FIELD_DEFS[key]?.label ?? customFieldDefs.find(d => d.key === key)?.label ?? key;

  const displayed = search
    ? order.filter(k => getLabel(k).toLowerCase().includes(search.toLowerCase()))
    : order;

  return (
    <div className="cp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cp-panel">
        <div className="cp-header">
          Manage Columns
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}
          >×</button>
        </div>
        <div className="cp-search">
          <input
            type="text"
            placeholder="Search columns…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="cp-list">
          {displayed.map(key => {
            if (!FIELD_DEFS[key] && !customFieldDefs.find(d => d.key === key)) return null;
            return (
              <div
                key={key}
                className="cp-toggle"
                draggable={!search}
                onDragStart={() => handleDragStart(key)}
                onDragEnter={() => handleDragEnter(key)}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                {!search && (
                  <span className="cp-drag-handle" title="Drag to reorder">⠿</span>
                )}
                <input
                  type="checkbox"
                  checked={!hidden.has(key)}
                  onChange={e => toggle(key, e.target.checked)}
                  style={{ accentColor: 'var(--navy)', flexShrink: 0 }}
                />
                {getLabel(key)}
              </div>
            );
          })}
        </div>
        <div className="cp-footer">
          <button
            className="cp-btn secondary"
            onClick={() => setHidden(new Set())}
          >
            Show All
          </button>
          <button className="cp-btn primary" onClick={handleDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
