import type { ReactNode } from "react";

export type PillTone = "navy" | "red" | "green" | "amber" | "muted" | "default";

export function Pill({ tone = "default", children }: { tone?: PillTone; children: ReactNode }) {
  const cls = tone === "default" ? "lum-pill" : `lum-pill is-${tone}`;
  return <span className={cls}>{children}</span>;
}
