import { useState, useRef, useMemo } from 'react';
import { useDataverse, type FetchQuery } from './hooks/useDataverse';
import { useAirtable } from './hooks/useAirtable';

const CLIENT_SIDE_QUERY = import.meta.env.VITE_DATA_SOURCE === 'airtable';
const useData = CLIENT_SIDE_QUERY ? useAirtable : useDataverse;
import { useViewPrefs } from './hooks/useViewPrefs';
import { useGrid } from './hooks/useGrid';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { applyClientSideQuery, applyServerPagePostProcess } from './hooks/applyQuery';
import { useCustomFields } from './hooks/useCustomFields';
import { useViewNames } from './hooks/useViewNames';
import { useSidebarLayout } from './hooks/useSidebarLayout';
import { useSchedules } from './hooks/useSchedules';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import Toolbar from './components/Toolbar/Toolbar';
import Grid from './components/Grid/Grid';
import { ErrorBoundary } from './components/Grid/ErrorBoundary';
import ColumnPanel from './components/ColumnPanel/ColumnPanel';
import FieldManager from './components/FieldManager/FieldManager';
import HomeScreen from './components/HomeScreen/HomeScreen';
import { VIEW_NAMES, VIEW_COLS } from './data/viewConfigs';
import { FIELD_DEFS } from './data/fieldDefs';

const ALL_BASE_COLS = Object.keys(FIELD_DEFS);
import type { LniRecord } from './types/schema';

function exportCsv(viewName: string, cols: string[], records: LniRecord[]) {
  const headers = cols.map(k => FIELD_DEFS[k]?.label ?? k);
  const rows = records.map(r =>
    cols.map(k => {
      const v = r[k as keyof LniRecord];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    })
  );
  const csv = [headers, ...rows].map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${viewName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Inner component so hooks re-initialize when scheduleId changes
function ScheduleApp({ scheduleId, scheduleName, onHome }: { scheduleId: string; scheduleName: string; onHome: () => void }) {
  const [activeView, setActiveView] = useState<string>(VIEW_NAMES[0]);
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const [fieldMgrOpen, setFieldMgrOpen] = useState(false);

  const { getVisibleCols, savePref, prefs } = useViewPrefs();
  const { getDisplayName, setDisplayName } = useViewNames(scheduleId);
  const { groups, moveView, moveGroup, renameGroup, addGroup, deleteGroup, addView } = useSidebarLayout(scheduleId);
  const recordsRef = useRef<LniRecord[]>([]);

  const {
    state: gridState,
    setSearch,
    setSorts,
    setFilters,
    setGroupField,
    setManualOrder,
    toggleSort,
  } = useGrid(scheduleId, activeView);

  const visibleCols = getVisibleCols(activeView);

  // Search is debounced (300ms) before it becomes part of the Dataverse query —
  // the input itself stays responsive via gridState.searchQuery.
  const debouncedSearch = useDebouncedValue(gridState.searchQuery, 300);

  // The full server-side query: sort / filter / search / group / view columns.
  const query = useMemo<FetchQuery>(() => ({
    viewCols: visibleCols,
    sorts: gridState.sorts,
    filters: gridState.filters,
    groupField: gridState.groupField,
    searchQuery: debouncedSearch,
  }), [visibleCols, gridState.sorts, gridState.filters, gridState.groupField, debouncedSearch]);

  const dataHook = useData(query);
  const { state: dvState, patch, create, loadMore, hasMore, loadingMore, cellErrors } = dataHook;
  const reload = dataHook.reload;
  const lastFetched = dataHook.lastFetched;

  const allRecords = dvState.status === 'ready' ? dvState.records : [];
  recordsRef.current = allRecords;

  const { defs: customFieldDefs, getValue: getCustomValue, setValue: setCustomValue, addFields, updateField, deleteField } = useCustomFields(scheduleId, recordsRef);

  // Records ready for display. The Dataverse path only needs the small client-side
  // residue (custom-field filters, manual order, calc-column sort); the Airtable
  // bridge runs the full query client-side. Memoised so it never reprocesses
  // unless an input actually changed.
  const displayRecords = useMemo(() =>
    CLIENT_SIDE_QUERY
      ? applyClientSideQuery(allRecords, gridState.searchQuery, gridState.filters, gridState.sorts, gridState.groupField, gridState.manualOrder, getCustomValue)
      : applyServerPagePostProcess(allRecords, gridState.sorts, gridState.filters, gridState.manualOrder, getCustomValue),
    [allRecords, gridState.searchQuery, gridState.filters, gridState.sorts, gridState.groupField, gridState.manualOrder, getCustomValue]
  );

  const handleAddFields = (fields: Parameters<typeof addFields>[0]) => {
    const keys = addFields(fields);
    const currentPref = prefs[activeView];
    const baseOrder = (currentPref?.order?.length ?? 0) > 0
      ? currentPref!.order
      : (VIEW_COLS[activeView] ?? []);
    const baseHidden = currentPref?.hidden ?? [];
    const newKeys = keys.filter(k => !baseOrder.includes(k));
    if (newKeys.length > 0) {
      savePref(activeView, { hidden: baseHidden, order: [...baseOrder, ...newKeys] });
    }
  };

  const handleAddView = (name: string) => {
    const key = `cv_${Date.now()}`;
    setDisplayName(key, name);
    savePref(key, { hidden: [], order: ALL_BASE_COLS });
    addView(key);
    setActiveView(key);
  };

  const handleReorder = (newFilteredIds: string[]) => {
    const filteredSet = new Set(newFilteredIds);
    const unfilteredIds = allRecords.filter(r => !filteredSet.has(r.id)).map(r => r.id);
    setManualOrder([...newFilteredIds, ...unfilteredIds]);
  };

  return (
    <div className="app">
      <Header
        viewName={getDisplayName(activeView)}
        scheduleName={scheduleName}
        onExport={() => exportCsv(activeView, visibleCols, displayRecords)}
        onHome={onHome}
        onNewRecord={() => create({
          status: 'New Order this week', process: 'Added',
          region: 'WK', metal: 'X', assembly: 'X',
          paintPrep: 'X', materialCut: 'X', plex: 'X',
          orderDate: new Date().toISOString().slice(0, 10),
        })}
      />
      <div className="app-body">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          getDisplayName={getDisplayName}
          setDisplayName={setDisplayName}
          groups={groups}
          moveView={moveView}
          moveGroup={moveGroup}
          renameGroup={renameGroup}
          addGroup={addGroup}
          deleteGroup={deleteGroup}
          onAddView={handleAddView}
        />
        <div className="main">
          <Toolbar
            searchQuery={gridState.searchQuery}
            onSearch={setSearch}
            sorts={gridState.sorts}
            onSortsChange={setSorts}
            filters={gridState.filters}
            onFiltersChange={setFilters}
            groupField={gridState.groupField}
            onGroupFieldChange={setGroupField}
            onOpenColumns={() => setColPanelOpen(true)}
            onOpenFields={() => setFieldMgrOpen(true)}
            customFieldDefs={customFieldDefs}
            recordCount={displayRecords.length}
            onRefresh={reload}
            lastFetched={lastFetched}
          />
          {dvState.status === 'error' ? (
            <div className="state-center" style={{ color: '#E8151B' }}>
              Error: {dvState.message}
            </div>
          ) : (
            <ErrorBoundary
              fallback={
                <div className="state-center" style={{ color: '#E8151B' }}>
                  The grid hit an unexpected error. Try refreshing.
                </div>
              }
            >
              <Grid
                records={displayRecords}
                visibleCols={visibleCols}
                groupField={gridState.groupField}
                sorts={gridState.sorts}
                onToggleSort={toggleSort}
                manualOrder={gridState.manualOrder}
                onReorder={handleReorder}
                onPatch={patch}
                onCreate={create}
                customFieldDefs={customFieldDefs}
                getCustomValue={getCustomValue}
                onCustomPatch={setCustomValue}
                loading={dvState.status === 'loading'}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
                cellErrors={cellErrors}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
      {colPanelOpen && (
        <ColumnPanel
          viewName={activeView}
          visibleCols={visibleCols}
          customFieldDefs={customFieldDefs}
          onClose={() => setColPanelOpen(false)}
          onSave={(hidden, order) => {
            savePref(activeView, { hidden, order });
            setColPanelOpen(false);
          }}
        />
      )}
      {fieldMgrOpen && (
        <FieldManager
          defs={customFieldDefs}
          onAddFields={handleAddFields}
          onUpdate={updateField}
          onDelete={deleteField}
          onClose={() => setFieldMgrOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const { schedules, createSchedule, duplicateSchedule, renameSchedule, deleteSchedule } = useSchedules();

  if (activeScheduleId === null) {
    return (
      <HomeScreen
        schedules={schedules}
        onCreate={name => {
          const s = createSchedule(name);
          setActiveScheduleId(s.id);
        }}
        onDuplicate={id => {
          const s = duplicateSchedule(id);
          setActiveScheduleId(s.id);
        }}
        onRename={renameSchedule}
        onDelete={id => {
          deleteSchedule(id);
          if (activeScheduleId === id) setActiveScheduleId(null);
        }}
        onOpen={setActiveScheduleId}
      />
    );
  }

  const activeSchedule = schedules.find(s => s.id === activeScheduleId);

  return (
    <ScheduleApp
      key={activeScheduleId}
      scheduleId={activeScheduleId}
      scheduleName={activeSchedule?.name ?? ''}
      onHome={() => setActiveScheduleId(null)}
    />
  );
}
