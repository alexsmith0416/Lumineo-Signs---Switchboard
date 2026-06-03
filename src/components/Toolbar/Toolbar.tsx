import { useState, useEffect, useRef } from 'react';
import type { SortCriterion, FilterCondition } from '../../hooks/useGrid';
import type { CustomFieldDef } from '../../types/schema';
import SortPanel from '../SortPanel/SortPanel';
import FilterPanel from '../FilterPanel/FilterPanel';
import GroupPanel from '../GroupPanel/GroupPanel';

type Panel = 'sort' | 'filter' | 'group' | null;

interface Props {
  searchQuery: string;
  onSearch: (q: string) => void;
  sorts: SortCriterion[];
  onSortsChange: (sorts: SortCriterion[]) => void;
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  groupField: string | null;
  onGroupFieldChange: (field: string | null) => void;
  onOpenColumns: () => void;
  onOpenFields: () => void;
  customFieldDefs?: CustomFieldDef[];
  recordCount: number;
  onRefresh?: () => void;
  lastFetched?: Date | null;
}

function formatLastFetched(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  return `${diffMin} min ago`;
}

export default function Toolbar({
  searchQuery, onSearch,
  sorts, onSortsChange,
  filters, onFiltersChange,
  groupField, onGroupFieldChange,
  onOpenColumns, onOpenFields, customFieldDefs = [], recordCount,
  onRefresh, lastFetched,
}: Props) {
  const [, forceUpdate] = useState(0);
  // Re-render every minute so the "X min ago" label stays fresh
  useEffect(() => {
    if (!lastFetched) return;
    const id = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(id);
  }, [lastFetched]);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpenPanel(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (panel: Panel) => setOpenPanel(p => p === panel ? null : panel);

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <div className="toolbar">
        <div className="t-search">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
            <circle cx="6" cy="6" r="4"/><path d="M9.5 9.5l3 3"/>
          </svg>
          <input
            type="text"
            placeholder="Search records…"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
        <div className="t-sep" />
        <button
          className={`t-btn${groupField !== null ? ' active' : ''}${openPanel === 'group' ? ' open' : ''}`}
          onClick={() => toggle('group')}
        >
          <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <path d="M1 3h11M3 6.5h7M5 10h3"/>
          </svg>
          Group{groupField !== null ? ' · 1' : ''}
        </button>
        <button
          className={`t-btn${filters.length > 0 ? ' active' : ''}${openPanel === 'filter' ? ' open' : ''}`}
          onClick={() => toggle('filter')}
        >
          <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <path d="M1 2h11l-4 5v4l-3-1.5V7L1 2z"/>
          </svg>
          Filter{filters.length > 0 ? ` · ${filters.length}` : ''}
        </button>
        <button
          className={`t-btn${sorts.length > 0 ? ' active' : ''}${openPanel === 'sort' ? ' open' : ''}`}
          onClick={() => toggle('sort')}
        >
          <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <path d="M2 2l4 9 2-5 4-4M2 2h6"/>
          </svg>
          Sort{sorts.length > 0 ? ` · ${sorts.length}` : ''}
        </button>
        <div className="t-sep" />
        <button className="t-btn" onClick={onOpenColumns}>
          <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <rect x="1" y="1" width="3" height="11" rx="1"/>
            <rect x="5" y="1" width="3" height="11" rx="1"/>
            <rect x="9" y="1" width="3" height="11" rx="1"/>
          </svg>
          Columns
        </button>
        <button className="t-btn" onClick={onOpenFields}>
          <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <circle cx="6.5" cy="6.5" r="5"/><path d="M6.5 4v5M4 6.5h5"/>
          </svg>
          Fields
        </button>
        <div className="t-right">
          {onRefresh && (
            <button className="t-btn t-refresh" onClick={onRefresh} title="Refresh data">
              <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                <path d="M11 6.5A4.5 4.5 0 1 1 9 2.7"/>
                <path d="M9 1v2.5H11.5"/>
              </svg>
              {lastFetched ? formatLastFetched(lastFetched) : 'Refresh'}
            </button>
          )}
          <span className="record-count">{recordCount} records</span>
        </div>
      </div>

      {openPanel === 'sort' && (
        <SortPanel sorts={sorts} onChange={onSortsChange} onClose={() => setOpenPanel(null)} />
      )}
      {openPanel === 'filter' && (
        <FilterPanel filters={filters} onChange={onFiltersChange} onClose={() => setOpenPanel(null)} customFieldDefs={customFieldDefs} />
      )}
      {openPanel === 'group' && (
        <GroupPanel groupField={groupField} onChange={onGroupFieldChange} onClose={() => setOpenPanel(null)} />
      )}
    </div>
  );
}
