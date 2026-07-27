import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import {
  useInstallationStoreNEK,
  useInstallationStoreWK,
} from "../store/schedule-store";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { useAssistStore } from "../store/assist-store";
import type { AssistHalf } from "../services/dataverse-live";
import {
  useInstallationScenarioStoreNEK,
  useInstallationScenarioStoreWK,
} from "../store/scenario-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import { cardMoneyValue } from "./JobCard";
import AddJobPanel from "./AddJobPanel";
import EditJobPanel from "./EditJobPanel";
import BatchListPanel from "./BatchListPanel";
import { scheduleBatch, batchItemFromQueueItem, type BatchItem } from "../services/batch-schedule";
import { useInstallQueueStoreWK, useInstallQueueStoreNEK } from "../store/job-queue-store";
import type { ScheduleLine } from "../engine/types";
import VisibilityMenu from "./VisibilityMenu";
import ToggleChip from "./ToggleChip";

type Region = "WK" | "NEK";

interface InstallationCalendarProps {
  onNavigate?: (view: string) => void;
  /** $ values are Admin/Ops only; hides the $ toggle + billing figures. */
  canSeeMoney?: boolean;
  /** Crew/truck logistics are Admin/Ops only; hides the Crew/Truck toggle +
   *  crew badges for basic users. */
  canSeeCrew?: boolean;
  /** Which region the board opens on (installer types default to theirs). */
  initialRegion?: Region;
  /** View-only (non-Admin/Ops): disables all editing affordances. */
  readOnly?: boolean;
}

export const MONTHLY_INSTALL_GOAL = 1_100_000;

export default function InstallationCalendar({
  onNavigate,
  canSeeMoney = false,
  canSeeCrew = false,
  initialRegion = "WK",
  readOnly = false,
}: InstallationCalendarProps = {}) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [showInvoice, setShowInvoice] = useState(true);
  const showMoney = canSeeMoney && showInvoice;
  const [showWeather, setShowWeather] = useState(true);
  const [showCrew, setShowCrew] = useState(true);
  // Crew/truck is Admin/Ops only; basic users never see the badge or its toggle.
  const showCrewBadge = canSeeCrew && showCrew;
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);
  const [createDraft, setCreateDraft] = useState<ScheduleLine | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [showBatchList, setShowBatchList] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [editBatchItem, setEditBatchItem] = useState<BatchItem | null>(null);
  const [hiddenDeptIds, setHiddenDeptIds] = useState<Set<string>>(new Set());
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());

  const useStore = region === "WK" ? useInstallationStoreWK : useInstallationStoreNEK;
  const scenarioStore =
    region === "WK" ? useInstallationScenarioStoreWK : useInstallationScenarioStoreNEK;
  // Region's Job Queue groups (for pre-loading into the batch list).
  const queueStore = region === "WK" ? useInstallQueueStoreWK : useInstallQueueStoreNEK;
  const queueGroups = queueStore((s) => s.groups);
  const loadQueue = queueStore((s) => s.load);
  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);
  const queueGroupOptions = queueGroups.map((g) => ({ id: g.id, name: g.name, count: g.items.length }));
  const loadGroupIntoBatch = (groupId: string) => {
    const g = queueGroups.find((x) => x.id === groupId);
    if (!g) return;
    setBatch((b) => [...b, ...g.items.map(batchItemFromQueueItem)]);
  };
  const weekStart = useStore((s) => s.weekStart);

  // "Assist installation" INVERSE: on the install board, a lent production person
  // shows a "Production" filler on the days/halves they're in the shop (not lent),
  // mirroring the "Installation" filler on the production board. Keyed by the
  // assist row's install-employee id (how they appear on this board).
  const assistRows = useAssistStore((s) => s.rows);
  const refreshAssist = useAssistStore((s) => s.refresh);
  useEffect(() => {
    void refreshAssist();
  }, [refreshAssist]);
  const weekMonday = format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const productionDaysByEmployee = useMemo(() => {
    const m = new Map<string, Map<number, AssistHalf>>();
    for (const a of assistRows) {
      if (a.weekStart !== weekMonday) continue;
      const installSet = new Set(a.days.length ? a.days : [0, 1, 2, 3, 4]);
      const byDay = new Map<number, AssistHalf>();
      for (let d = 0; d < 5; d++) {
        if (!installSet.has(d)) {
          byDay.set(d, "full"); // whole day in production (not lent)
        } else if (a.halves[d] === "am") {
          byDay.set(d, "pm"); // on install AM → in production PM
        } else if (a.halves[d] === "pm") {
          byDay.set(d, "am"); // on install PM → in production AM
        } // full install day → no production filler
      }
      if (byDay.size) m.set(a.id, byDay);
    }
    return m;
  }, [assistRows, weekMonday]);
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);

  // Ensure both stores have loaded so the combined billing stat can be
  // computed accurately regardless of which region is currently displayed.
  const loadWK = useInstallationStoreWK((s) => s.loadWeek);
  const loadNEK = useInstallationStoreNEK((s) => s.loadWeek);
  useEffect(() => {
    void loadWK();
    void loadNEK();
  }, [loadWK, loadNEK]);

  // Compute combined week billing across BOTH regions so the user can see
  // how their monthly goal is tracking even when only one region is on screen.
  const wkSchedule = useInstallationStoreWK((s) => s.schedule);
  const wkWeekStart = useInstallationStoreWK((s) => s.weekStart);
  const nekSchedule = useInstallationStoreNEK((s) => s.schedule);
  const nekWeekStart = useInstallationStoreNEK((s) => s.weekStart);

  const combinedThisWeek = (() => {
    const ws = region === "WK" ? wkWeekStart : nekWeekStart;
    const wsEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Each job counted once (across both regions), by its card money value.
    const jobs = new Map<string, number>();
    for (const l of [...wkSchedule, ...nekSchedule]) {
      if (l.startDateTime < ws || l.startDateTime >= wsEnd) continue;
      const v = cardMoneyValue(l) ?? 0;
      if (v > 0 && !jobs.has(l.jobNo)) jobs.set(l.jobNo, v);
    }
    return [...jobs.values()].reduce((a, b) => a + b, 0);
  })();

  // "Final install" cards set the job's scheduled install date to their day.
  // A Red date locks the scheduled date, so it wins. If a job has more than one
  // final card, the latest day is used. Idempotent (only writes on a change).
  const jobSchedByJob = useJobScheduleStore((s) => s.byJob);
  const updateJobSched = useJobScheduleStore((s) => s.update);
  useEffect(() => {
    const finalByJob = new Map<string, Date>();
    for (const line of [...wkSchedule, ...nekSchedule]) {
      if (!line.finalInstall || !line.jobNo || line.isCustom) continue;
      const day = startOfDay(line.startDateTime);
      const existing = finalByJob.get(line.jobNo);
      if (!existing || day > existing) finalByJob.set(line.jobNo, day);
    }
    for (const [jobNo, day] of finalByJob) {
      const js = jobSchedByJob[jobNo];
      if (js?.redDate) continue; // red date locks the scheduled date
      const cur = js?.scheduledInstallDate ?? null;
      if (!cur || !isSameDay(cur, day)) void updateJobSched(jobNo, { scheduledInstallDate: day });
    }
  }, [wkSchedule, nekSchedule, jobSchedByJob, updateJobSched]);

  // The WK/NEK region toggle sits directly under the page header, left-justified
  // (a banner above the board), on both desktop and mobile.
  const regionToggle = (
    <div className="region-banner">
      <div className="region-toggle" role="group" aria-label="Region">
        {(["WK", "NEK"] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={"region-toggle__btn" + (region === r ? " region-toggle__btn--active" : "")}
            onClick={() => setRegion(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );

  // A fragment (not a wrapping div) so each control is a direct child of the
  // toolbar tools row — same as Production — and wraps uniformly on mobile.
  const toolbar = (
    <>
      {canSeeMoney && (
        <ToggleChip label="$" active={showInvoice} onClick={() => setShowInvoice((v) => !v)} accent="var(--status-green)" />
      )}
      <ToggleChip label="🌤" active={showWeather} onClick={() => setShowWeather((v) => !v)} />
      {canSeeCrew && (
        <ToggleChip label="Crew/Truck" active={showCrew} onClick={() => setShowCrew((v) => !v)} />
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
        departmentLabel="Location"
      />
    </>
  );

  return (
    <>
      <CalendarView
        useStore={useStore}
        readOnly={readOnly}
        kindMeta={{
          ...KIND_META.installation,
          title: `Installation & Service Schedule · ${region}`,
        }}
        cardLayout="stacked"
        assistDaysByEmployee={productionDaysByEmployee}
        assistFiller={{ full: "Production", half: "Prod" }}
        showInvoice={showMoney}
        showCrewBadge={showCrewBadge}
        showWeather={showWeather}
        showBillingStats={showMoney}
        monthlyGoal={showMoney ? MONTHLY_INSTALL_GOAL : undefined}
        combinedBillingThisWeek={showMoney ? combinedThisWeek : undefined}
        toolbarExtras={toolbar}
        bannerSlot={regionToggle}
        installLayout
        onNavigate={onNavigate}
        supportsScenarioSandbox={!!onNavigate}
        enableJobQueue={!readOnly}
        scenarioStore={scenarioStore}
        hiddenDeptIds={hiddenDeptIds}
        hiddenEmployeeIds={hiddenEmployeeIds}
        enableResourceAdmin={!readOnly}
        installRegionIsNek={region === "NEK"}
        rosterUnlockable={!readOnly}
        addAction={
          readOnly ? undefined : (
            <button
              className="btn-add-job"
              onClick={() =>
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
          readOnly ? undefined : ({ start, employeeId }) => setAddJobContext({ start, employeeId })
        }
      />
      {addJobContext && (
        <AddJobPanel
          initialStart={addJobContext.start}
          initialEmployeeId={addJobContext.employeeId}
          onClose={() => setAddJobContext(null)}
          onConfigure={(draft) => setCreateDraft(draft)}
          useStore={useStore}
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
          useStore={useStore}
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
              await scheduleBatch(batch, useStore, fromDate);
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
          useStore={useStore}
        />
      )}
    </>
  );
}
