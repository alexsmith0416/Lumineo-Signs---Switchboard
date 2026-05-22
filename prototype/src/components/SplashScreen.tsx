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
      <DaysCounter safety={safetyMetric} />
      <KpiStrip kpis={kpis} />
      {visibleAnnouncements.map((a) => (
        <AnnouncementCard key={a.id} announcement={a} />
      ))}
      <BirthdayStrip birthdays={birthdays} />
      <AppLauncher tiles={appTiles} role={role} />
      <RoleWidgets role={role} />
      <PhotoReel photos={photos} />
    </main>
  );
}
