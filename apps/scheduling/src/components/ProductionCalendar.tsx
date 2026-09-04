import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { useScheduleStore } from "../store/schedule-store";
import { useAssistStore } from "../store/assist-store";
import { useInstallCardsStore } from "../services/install-cards";
import { mirroredLinesByEmployee } from "../services/assist-mirror";
import { placeShipmentOnProductionEmployee } from "../services/lend-shipment";
import type { AssistHalf } from "../services/dataverse-live";
import { KIND_META } from "../services/data-source";
import { isLaneEmployeeId, laneDeptId } from "../services/department-lane";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";
import EditJobPanel from "./EditJobPanel";
import BatchListPanel from "./BatchListPanel";
import { scheduleBatch, batchItemFromQueueItem, type BatchItem } from "../services/batch-schedule";
import { useProductionQueueStore } from "../store/job-queue-store";
import type { ScheduleLine } from "../engine/types";
import VisibilityMenu from "./VisibilityMenu";
import ToggleChip from "./ToggleChip";

interface ProductionCalendarProps {
  readOnly?: boolean;
  bannerSlot?: React.ReactNode;
  onNavigate?: (view: string) => void;
  /** $ values are Admin/Ops only; hides the $ toggle + dollar figures. */
  canSeeMoney?: boolean;
}

export default function ProductionCalendar({ readOnly = false, bannerSlot, onNavigate, canSeeMoney = false }: ProductionCalendarProps) {
  const weekStart = useScheduleStore((s) => s.weekStart);
  const employees = useScheduleStore((s) => s.employees);
  const departments = useScheduleStore((s) => s.departments);
  const [showInvoice, setShowInvoice] = useState(true);
  const showMoney = canSeeMoney && showInvoice;
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
    departmentId?: string;
  } | null>(null);
  // A draft handed off from Add Job (search + task select) → opens the unified
  // create panel where the user configures + schedules it.
  const [createDraft, setCreateDraft] = useState<ScheduleLine | null>(null);
  // Batch (Multiple-jobs) scheduling: a prioritized staging list.
  const [batchMode, setBatchMode] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [showBatchList, setShowBatchList] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  // Editing an existing staged job (click a row in the list).
  const [editBatchItem, setEditBatchItem] = useState<BatchItem | null>(null);
  // Job Queue groups (for pre-loading into the list).
  const queueGroups = useProductionQueueStore((s) => s.groups);
  const loadQueue = useProductionQueueStore((s) => s.load);
  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);
  const queueGroupOptions = queueGroups.map((g) => ({ id: g.id, name: g.name, count: g.items.length }));
  const loadGroupIntoBatch = (groupId: string) => {
    const g = queueGroups.find((x) => x.id === groupId);
    if (!g) return;
    setBatch((b) => [...b, ...g.items.map(batchItemFromQueueItem)]);
  };
  const [hiddenDeptIds, setHiddenDeptIds] = useState<Set<string>>(new Set());
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());

  // "Assist installation" — grey the source employee's assigned days this week.
  const assistRows = useAssistStore((s) => s.rows);
  const refreshAssist = useAssistStore((s) => s.refresh);
  useEffect(() => {
    void refreshAssist();
  }, [refreshAssist]);
  const weekMonday = format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const assistDaysByEmployee = useMemo(() => {
    const m = new Map<string, Map<number, AssistHalf>>();
    for (const a of assistRows) {
      if (a.weekStart !== weekMonday) continue;
      const days = a.days.length ? a.days : [0, 1, 2, 3, 4];
      const byDay = new Map<number, AssistHalf>();
      // All-week / unspecified days are full; specific days carry their am/pm.
      for (const d of days) byDay.set(d, a.halves[d] ?? "full");
      m.set(a.sourceEmpId, byDay);
    }
    return m;
  }, [assistRows, weekMonday]);

  // A lent employee's install work, drawn read-only on their production row so
  // the production board shows their whole week (see services/assist-mirror.ts).
  // Both regions, because a person can be lent to either.
  const wkCards = useInstallCardsStore((s) => s.wk);
  const nekCards = useInstallCardsStore((s) => s.nek);
  const mirroredLines = useMemo(() => {
    const from = startOfWeek(weekStart, { weekStartsOn: 1 });
    const to = addDays(from, 6);
    to.setHours(23, 59, 59, 999);
    return mirroredLinesByEmployee(assistRows, [...wkCards, ...nekCards], weekMonday, from, to);
  }, [assistRows, wkCards, nekCards, weekMonday, weekStart]);

  return (
    <>
      <CalendarView
        useStore={useScheduleStore}
        kindMeta={KIND_META.production}
        readOnly={readOnly}
        assistDaysByEmployee={assistDaysByEmployee}
        mirroredLinesByEmployee={mirroredLines}
        showInvoice={showMoney}
        showTotalValue={showMoney}
        bannerSlot={bannerSlot}
        onNavigate={onNavigate}
        supportsScenarioSandbox={true}
        enableJobQueue={!readOnly}
        enableResourceAdmin={!readOnly}
        rosterUnlockable={!readOnly}
        enableDepartmentLane
        hideEmptyGroups
        hiddenDeptIds={hiddenDeptIds}
        hiddenEmployeeIds={hiddenEmployeeIds}
        toolbarExtras={
          <>
            {canSeeMoney && (
              <ToggleChip
                label="$"
                active={showInvoice}
                onClick={() => setShowInvoice((v) => !v)}
                accent="var(--status-green)"
              />
            )}
          <VisibilityMenu
            departments={[...departments.values()]}
            employees={[...employees.values()]}
            hiddenDeptIds={hiddenDeptIds}
            hiddenEmployeeIds={hiddenEmployeeIds}
            onToggleDept={(id) =>
              setHiddenDeptIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onToggleEmployee={(id) =>
              setHiddenEmployeeIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onShowAll={() => {
              setHiddenDeptIds(new Set());
              setHiddenEmployeeIds(new Set());
            }}
            resourceLabel="Employee"
            departmentLabel="Department"
          />
          </>
        }
        addAction={
          readOnly ? undefined : (
            <button
              className="btn-add-job"
              onClick={() =>
                // If a batch list is in progress, reopen it; otherwise start a new add.
                batch.length > 0
                  ? setShowBatchList(true)
                  : setAddJobContext({ start: addDays(weekStart, 0), employeeId: undefined })
              }
            >
              + Add Job
            </button>
          )
        }
        onEmptyCellClick={
          readOnly
            ? undefined
            : ({ start, employeeId }) =>
                // A click on the shared department lane (or the "+ Team job" button)
                // targets the whole department; a normal cell targets one employee.
                isLaneEmployeeId(employeeId)
                  ? setAddJobContext({ start, departmentId: laneDeptId(employeeId) })
                  : setAddJobContext({ start, employeeId })
        }
      />
      {addJobContext && (
        <AddJobPanel
          initialStart={addJobContext.start}
          initialEmployeeId={addJobContext.employeeId}
          initialDepartmentId={addJobContext.departmentId}
          onClose={() => setAddJobContext(null)}
          onConfigure={(draft) => setCreateDraft(draft)}
          onShipmentToInstall={async (employee, line) => {
            await placeShipmentOnProductionEmployee({ employee, line });
          }}
          batchMode={batchMode}
          onBatchModeChange={setBatchMode}
          batchCount={batch.length}
          queueGroups={queueGroupOptions}
          onLoadGroup={(groupId) => {
            loadGroupIntoBatch(groupId);
            setAddJobContext(null);
            setShowBatchList(true);
          }}
        />
      )}
      {createDraft && (
        <EditJobPanel
          line={createDraft}
          mode="create"
          batchMode={batchMode}
          onAddToBatch={(item) => {
            setBatch((b) => [...b, item]);
            setCreateDraft(null);
            setShowBatchList(true);
          }}
          onClose={() => setCreateDraft(null)}
        />
      )}
      {showBatchList && (
        <BatchListPanel
          items={batch}
          busy={batchBusy}
          onChange={setBatch}
          onRemove={(id) => setBatch((b) => b.filter((x) => x.id !== id))}
          onAddAnother={() => {
            setShowBatchList(false);
            setAddJobContext({ start: addDays(weekStart, 0), employeeId: undefined });
          }}
          onScheduleAll={async (fromDate) => {
            setBatchBusy(true);
            try {
              await scheduleBatch(batch, useScheduleStore, fromDate);
            } finally {
              setBatchBusy(false);
            }
            setBatch([]);
            setShowBatchList(false);
            setBatchMode(false);
          }}
          onClose={() => setShowBatchList(false)}
          queueGroups={queueGroupOptions}
          onLoadGroup={loadGroupIntoBatch}
          onEditItem={(item) => setEditBatchItem(item)}
        />
      )}
      {editBatchItem && (
        <EditJobPanel
          line={editBatchItem.draft}
          mode="create"
          batchMode
          batchItemId={editBatchItem.id}
          seedEmployeeId={editBatchItem.employeeId ?? ""}
          seedStart={editBatchItem.start}
          onAddToBatch={(updated) => {
            setBatch((b) => b.map((x) => (x.id === updated.id ? updated : x)));
            setEditBatchItem(null);
          }}
          onClose={() => setEditBatchItem(null)}
        />
      )}
    </>
  );
}
