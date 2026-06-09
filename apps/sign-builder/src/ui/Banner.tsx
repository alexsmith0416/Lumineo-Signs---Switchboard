import type { ReactNode } from "react";

export type BannerTone = "amber" | "red" | "info";

export function Banner({ tone, children }: { tone: BannerTone; children: ReactNode }) {
  return (
    <div className={`lum-banner is-${tone}`} role={tone === "red" ? "alert" : "status"}>
      {children}
    </div>
  );
}
