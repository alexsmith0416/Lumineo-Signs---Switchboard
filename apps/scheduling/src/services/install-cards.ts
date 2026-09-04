import { create } from "zustand";
import type { ScheduleLine } from "../engine/types";

/**
 * Reactive cache of installation calendar cards (custom blocks + shipment
 * cards), keyed by region. Persisted to Dataverse (crfdf_installcard) by the
 * live install data source, which keeps this cache in sync so the Shipping
 * board's "Scheduled" badge reacts to placements. In dev (mock source) this
 * stays empty.
 */
export type InstallRegionKey = "wk" | "nek";

interface InstallCardsState {
  wk: ScheduleLine[];
  nek: ScheduleLine[];
}

export const useInstallCardsStore = create<InstallCardsState>(() => ({ wk: [], nek: [] }));

export function setRegionCards(region: InstallRegionKey, cards: ScheduleLine[]): void {
  useInstallCardsStore.setState({ [region]: cards } as Partial<InstallCardsState>);
}
export function cacheAddCard(region: InstallRegionKey, line: ScheduleLine): void {
  useInstallCardsStore.setState((s) => ({ [region]: [...s[region], line] }) as Partial<InstallCardsState>);
}
export function cacheUpdateCard(region: InstallRegionKey, id: string, line: ScheduleLine): void {
  useInstallCardsStore.setState(
    (s) => ({ [region]: s[region].map((l) => (l.id === id ? line : l)) }) as Partial<InstallCardsState>,
  );
}
export function cacheRemoveCard(region: InstallRegionKey, id: string): void {
  useInstallCardsStore.setState(
    (s) => ({ [region]: s[region].filter((l) => l.id !== id) }) as Partial<InstallCardsState>,
  );
}

/** True if a load (by id) has been placed on the install schedule (either region). */
export function useLoadScheduled(loadId: string): boolean {
  return useInstallCardsStore(
    (s) =>
      s.wk.some((l) => l.shipmentLoadId === loadId) ||
      s.nek.some((l) => l.shipmentLoadId === loadId),
  );
}

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * Warm the cache at boot.
 *
 * Two features READ install cards without owning the install board: the
 * Shipping "Scheduled" badge, and the Production board's mirrored rows for a
 * lent employee. Both must work whether or not the user has opened Installation
 * this session, so the cache can't wait for that board to load. Live already
 * did this; dev didn't, so mirroring silently showed nothing until you visited
 * Installation first.
 */
export async function hydrateInstallCards(): Promise<void> {
  if (LIVE) {
    const m = await import("./dataverse-live");
    await m.hydrateInstallCardCache();
    return;
  }
  const [{ WK_LINES, NEK_LINES }, { mockAssistCards }] = await Promise.all([
    import("../data/mock-installation"),
    import("../data/mock-assist"),
  ]);
  setRegionCards("wk", [...WK_LINES, ...mockAssistCards()]);
  setRegionCards("nek", NEK_LINES);
}
