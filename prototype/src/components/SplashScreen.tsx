import type { Role } from "../types";
import {
  announcements,
  appTiles,
  birthdays,
  kpisByRole,
  myJobsByRole,
  photos,
  resourcesByRole,
  safetyMetric,
} from "../data/mockData";
import DaysCounter from "./DaysCounter";
import KpiStrip from "./KpiStrip";
import AnnouncementCard from "./AnnouncementCard";
import BirthdayStrip from "./BirthdayStrip";
import AppLauncher from "./AppLauncher";
import MyScheduleSection from "./MyScheduleSection";
import PhotoReel from "./PhotoReel";
import RoleWidgets from "./RoleWidgets";

interface Props {
  role: Role;
  kpiWidth: number | null;
  kpiCols: number;
  tileWidth: number | null;
  tileCols: number;
  widgetWidth: number | null;
  widgetCols: number;
  contentW: number | null;
  onOpenMySchedule: () => void;
}

export default function SplashScreen({
  role,
  kpiWidth,
  kpiCols,
  tileWidth,
  tileCols,
  widgetWidth,
  widgetCols,
  contentW,
  onOpenMySchedule,
}: Props) {
  const kpis = kpisByRole[role];
  const me = resourcesByRole[role];
  const myJobs = myJobsByRole[role];
  const visibleAnnouncements = announcements.filter(
    (a) => a.audience === "All" || a.audience === role,
  );

  // Force every direct child of .splash to be exactly contentW pixels wide
  // via a single-column grid. Combined with the explicit pixel widths inside
  // KpiStrip/AppLauncher, this means nothing inside .splash can overflow
  // horizontally regardless of how the Brave WebView resolves widths.
  const splashStyle: React.CSSProperties = contentW
    ? {
        display: "grid",
        gridTemplateColumns: `${contentW}px`,
        gap: "12px",
        margin: "0 auto",
        padding: "10px 0 24px",
      }
    : {};

  const fullStyle: React.CSSProperties = contentW
    ? { width: `${contentW}px`, maxWidth: `${contentW}px` }
    : {};

  return (
    <main className="splash" style={splashStyle}>
      <section className="glance" aria-label="At-a-glance" style={fullStyle}>
        <DaysCounter safety={safetyMetric} />
        <KpiStrip kpis={kpis} itemWidth={kpiWidth} cols={kpiCols} />
      </section>

      <AppLauncher tiles={appTiles} role={role} itemWidth={tileWidth} cols={tileCols} />

      <div style={fullStyle}>
        <MyScheduleSection me={me} jobs={myJobs} onOpenFull={onOpenMySchedule} />
      </div>

      {visibleAnnouncements.length > 0 && (
        <div className="announcements" style={fullStyle}>
          {visibleAnnouncements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}

      <RoleWidgets
        role={role}
        containerWidth={contentW}
        widgetWidth={widgetWidth}
        widgetCols={widgetCols}
      />

      <BirthdayStrip birthdays={birthdays} containerWidth={contentW} />
      <PhotoReel photos={photos} containerWidth={contentW} />
    </main>
  );
}
