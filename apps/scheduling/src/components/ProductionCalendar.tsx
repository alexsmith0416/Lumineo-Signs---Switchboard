import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { useScheduleStore } from "../store/schedule-store";
import { useAssistStore } from "../store/assist-store";
import type { AssistHalf } from "../services/dataverse-live";
import { KIND_META } from "../services/data-source";
import { isLaneEmployeeId, laneDeptId } from "../services/department-lane";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";
import EditJobPanel from "./EditJobPanel";
import BatchListPanel from "./BatchListPanel";
import { scheduleBatch, type BatchItem } from "../services/batch-schedule";
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

  return (
    <>
      <CalendarView
        useStore={useScheduleStore}
        kindMeta={KIND_META.production}
        readOnly={readOnly}
        assistDaysByEmployee={assistDaysByEmployee}
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
          batchMode={batchMode}
          onBatchModeChange={setBatchMode}
          batchCount={batch.length}
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
          onScheduleAll={async () => {
            setBatchBusy(true);
            try {
              await scheduleBatch(batch, useScheduleStore);
            } finally {
              setBatchBusy(false);
            }
            setBatch([]);
            setShowBatchList(false);
            setBatchMode(false);
          }}
          onClose={() => setShowBatchList(false)}
        />
      )}
    </>
  );
}
