import type { Role } from "../types";
import {
  announcements,
  appTiles,
  birthdays,
  kpisByRole,
  photos,
  safetyMetric,
} from "../data/mockData";
import DaysCounter from "./DaysCounter";
import KpiStrip from "./KpiStrip";
import AnnouncementCard from "./AnnouncementCard";
import BirthdayStrip from "./BirthdayStrip";
import AppLauncher from "./AppLauncher";
import PhotoReel from "./PhotoReel";
import RoleWidgets from "./RoleWidgets";

interface Props {
  role: Role;
}

export default function SplashScreen({ role }: Props) {
  const kpis = kpisByRole[role];
  const visibleAnnouncements = announcements.filter(
    (a) => a.audience === "All" || a.audience === role,
  );

  return (
    <main className="splash">
      <section className="glance" aria-label="At-a-glance">
        <DaysCounter safety={safetyMetric} />
        <KpiStrip kpis={kpis} />
      </section>

      <AppLauncher tiles={appTiles} role={role} />

      {visibleAnnouncements.length > 0 && (
        <div className="announcements">
          {visibleAnnouncements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}

      <RoleWidgets role={role} />

      <BirthdayStrip birthdays={birthdays} />
      <PhotoReel photos={photos} />
    </main>
  );
}
