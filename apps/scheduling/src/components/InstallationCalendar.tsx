import { useEffect, useState } from "react";
import { addDays } from "date-fns";
import {
  useInstallationStoreNEK,
  useInstallationStoreWK,
} from "../store/schedule-store";
import {
  useInstallationScenarioStoreNEK,
  useInstallationScenarioStoreWK,
} from "../store/scenario-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";
import VisibilityMenu from "./VisibilityMenu";
import ToggleChip from "./ToggleChip";

type Region = "WK" | "NEK";

interface InstallationCalendarProps {
  onNavigate?: (view: string) => void;
  /** $ values are Admin/Ops only; hides the $ toggle + billing figures. */
  canSeeMoney?: boolean;
  /** Which region the board opens on (installer types default to theirs). */
  initialRegion?: Region;
}

export const MONTHLY_INSTALL_GOAL = 1_100_000;

export default function InstallationCalendar({
  onNavigate,
  canSeeMoney = false,
  initialRegion = "WK",
}: InstallationCalendarProps = {}) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [showInvoice, setShowInvoice] = useState(true);
  const showMoney = canSeeMoney && showInvoice;
  const [showWeather, setShowWeather] = useState(true);
  const [showCrew, setShowCrew] = useState(true);
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);
  const [hiddenDeptIds, setHiddenDeptIds] = useState<Set<string>>(new Set());
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());

  const useStore = region === "WK" ? useInstallationStoreWK : useInstallationStoreNEK;
  const scenarioStore =
    region === "WK" ? useInstallationScenarioStoreWK : useInstallationScenarioStoreNEK;
  const weekStart = useStore((s) => s.weekStart);
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
    const sumForRange = (lines: typeof wkSchedule) =>
      lines
        .filter((l) => l.startDateTime >= ws && l.startDateTime < wsEnd)
        .reduce((s, l) => s + (l.invoiceAmount ?? 0), 0);
    return sumForRange(wkSchedule) + sumForRange(nekSchedule);
  })();

  const toolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          display: "inline-flex",
          borderRadius: 5,
          overflow: "hidden",
          border: "1px solid var(--lumineo-navy)",
        }}
      >
        {(["WK", "NEK"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            style={{
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              background: region === r ? "var(--lumineo-navy)" : "#fff",
              color: region === r ? "#fff" : "var(--lumineo-navy)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {r}
          </button>
        ))}
      </div>
      {canSeeMoney && (
        <ToggleChip label="$" active={showInvoice} onClick={() => setShowInvoice((v) => !v)} accent="var(--status-green)" />
      )}
      <ToggleChip label="🌤" active={showWeather} onClick={() => setShowWeather((v) => !v)} />
      <ToggleChip label="Crew/Truck" active={showCrew} onClick={() => setShowCrew((v) => !v)} />
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
    </div>
  );

  return (
    <>
      <CalendarView
        useStore={useStore}
        kindMeta={{
          ...KIND_META.installation,
          title: `Installation & Service Schedule · ${region}`,
        }}
        cardLayout="stacked"
        showInvoice={showMoney}
        showCrewBadge={showCrew}
        showWeather={showWeather}
        showBillingStats={showMoney}
        monthlyGoal={showMoney ? MONTHLY_INSTALL_GOAL : undefined}
        combinedBillingThisWeek={showMoney ? combinedThisWeek : undefined}
        toolbarExtras={toolbar}
        onNavigate={onNavigate}
        supportsScenarioSandbox={!!onNavigate}
        scenarioStore={scenarioStore}
        hiddenDeptIds={hiddenDeptIds}
        hiddenEmployeeIds={hiddenEmployeeIds}
        enableResourceAdmin
        installRegionIsNek={region === "NEK"}
        rosterUnlockable
        addAction={
          <button
            className="btn-add-job"
            onClick={() =>
              setAddJobContext({ start: addDays(weekStart, 0), employeeId: undefined })
            }
          >
            + Add Job
          </button>
        }
        onEmptyCellClick={({ start, employeeId }) =>
          setAddJobContext({ start, employeeId })
        }
      />
      {addJobContext && (
        <AddJobPanel
          initialStart={addJobContext.start}
          initialEmployeeId={addJobContext.employeeId}
          onClose={() => setAddJobContext(null)}
          useStore={useStore}
        />
      )}
    </>
  );
}
