import type { LniRecord } from '../types/schema';

function daysBetween(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
}

export function computeCalcFields(r: LniRecord): LniRecord {
  const dip = daysBetween(r.orderDate);
  const totalMfg =
    (r.paintPrepHrs ?? 0) + (r.paintHrs ?? 0) +
    (r.steelHrs ?? 0)    + (r.routingHrs ?? 0);
  const totalInstall =
    (r.steelHrs ?? 0) + (r.installHrs ?? 0) + (r.travelHrs ?? 0);

  return { ...r, dip, totalMfg, totalInstall };
}
