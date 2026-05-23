import { useEffect, useState } from "react";
import { addDays } from "date-fns";
import {
  useInstallationStoreNEK,
  useInstallationStoreWK,
} from "../store/schedule-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";

export const MONTHLY_INSTALL_GOAL = 1_100_000;

type Region = "WK" | "NEK";

export default function InstallationCalendar() {
  const [region, setRegion] = useState<Region>("WK");
  const [showInvoice, setShowInvoice] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showCrew, setShowCrew] = useState(true);
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);

  const useStore = region === "WK" ? useInstallationStoreWK : useInstallationStoreNEK;
  const weekStart = useStore((s) => s.weekStart);

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
      <ToggleChip label="$" active={showInvoice} onClick={() => setShowInvoice((v) => !v)} accent="#1b6e3e" />
      <ToggleChip label="🌤" active={showWeather} onClick={() => setShowWeather((v) => !v)} />
      <ToggleChip label="2M·1T" active={showCrew} onClick={() => setShowCrew((v) => !v)} />
    </div>
  );

  return (
    <>
      <CalendarView
        useStore={useStore}
        kindMeta={{
          ...KIND_META.installation,
          title: `Installation Scheduling · ${region}`,
        }}
        cardLayout="stacked"
        showInvoice={showInvoice}
        showCrewBadge={showCrew}
        showWeather={showWeather}
        showBillingStats={showInvoice}
        monthlyGoal={showInvoice ? MONTHLY_INSTALL_GOAL : undefined}
        combinedBillingThisWeek={showInvoice ? combinedThisWeek : undefined}
        toolbarExtras={toolbar}
        addAction={
          <button
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

function ToggleChip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  const activeBg = accent ?? "var(--lumineo-navy)";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 9px",
        fontSize: 12,
        fontWeight: 600,
        background: active ? activeBg : "#fff",
        color: active ? "#fff" : activeBg,
        border: `1px solid ${activeBg}`,
        borderRadius: 5,
        cursor: "pointer",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
      title={`Toggle ${label}`}
    >
      {label}
    </button>
  );
}
