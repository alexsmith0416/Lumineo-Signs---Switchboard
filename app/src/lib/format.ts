export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad2(m)}:${pad2(s)}`;
}

export function formatHM(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${pad2(m)}`;
}

export function formatHMShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h} h ${pad2(m)} m`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${ampm}`;
}

export function formatTimeRange(startIso: string, endIso: string | null): string {
  return `${formatTime(startIso)} – ${endIso ? formatTime(endIso) : "now"}`;
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatPhotoStamp(iso: string): string {
  const d = new Date(iso);
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${mm}/${dd} · ${formatTime(iso)}`;
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function isoDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ms duration between clock in/out (or now if open). */
export function punchDurationMs(clockInIso: string, clockOutIso: string | null): number {
  const start = new Date(clockInIso).getTime();
  const end = clockOutIso ? new Date(clockOutIso).getTime() : Date.now();
  return Math.max(0, end - start);
}
