// Shipping Schedule domain — a purpose-built model for organizing shipments,
// independent of the production/install scheduling engine (no truck/employee
// assignment). The unit you build and print is a LOAD.

import { format } from "date-fns";

export type ShipmentStatus = "planned" | "ready" | "loaded" | "delivered";
export type ItemKind = "delivery" | "pickup";

/** The NEK install region towns — collapsed to "NEK" in a load name when a
 *  single load drops at more than one of them. */
export const NEK_LOCATIONS = ["Olathe", "Topeka", "Lawrence"];

export interface ShipmentItem {
  id: string;
  /** BC job number, or null for a manual/non-job item (transformer, pickup…). */
  jobNo: string | null;
  customerName: string;
  /** Editable; defaults from the BC project description on import. */
  description: string;
  /** Loading/unloading instructions. */
  notes: string;
  /** Delivery/pickup town for this item (a load can serve several). */
  location: string;
  kind: ItemKind;
  /** Check-off used while physically loading the truck. */
  loaded: boolean;
}

export interface ShipmentLoad {
  id: string;
  /** Route/run name, e.g. "6/22 Dodge City Load". Auto-generated until the user
   *  hand-edits it (see `autoName`). */
  name: string;
  /** When true, `name` tracks the date + locations automatically; set false
   *  once the user types their own name (re-enabled if they clear it). */
  autoName: boolean;
  /** The day the load ships. */
  shipDate: Date;
  status: ShipmentStatus;
  /** Load-level notes (trailer swaps, etc.). */
  generalNotes: string;
  items: ShipmentItem[];
}

export const STATUS_ORDER: ShipmentStatus[] = ["planned", "ready", "loaded", "delivered"];

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  planned: "Planned",
  ready: "Ready",
  loaded: "Loaded",
  delivered: "Delivered",
};

/** Move one item to another position in the load's list (the order the driver
 *  works the run, and the order it prints). Pure; out-of-range moves are a
 *  no-op and return the original array. */
export function reorderItems(items: ShipmentItem[], from: number, to: number): ShipmentItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Unique, in-order, non-empty locations from a list of items. */
export function uniqueLocations(items: ShipmentItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const loc = it.location.trim();
    if (loc && !seen.has(loc)) {
      seen.add(loc);
      out.push(loc);
    }
  }
  return out;
}

/** Unique, in-order delivery locations across a load's items. */
export function loadLocations(load: ShipmentLoad): string[] {
  return uniqueLocations(load.items);
}

/** Collapse a set of stop locations into a name label. Multiple NEK towns →
 *  "NEK"; a single NEK town keeps its name; non-NEK towns pass through. */
function locationLabel(locs: string[]): string {
  const nekCount = locs.filter((l) => NEK_LOCATIONS.includes(l)).length;
  const segments: string[] = [];
  let nekAdded = false;
  for (const loc of locs) {
    if (NEK_LOCATIONS.includes(loc)) {
      if (nekCount > 1) {
        if (!nekAdded) { segments.push("NEK"); nekAdded = true; }
      } else {
        segments.push(loc);
      }
    } else {
      segments.push(loc);
    }
  }
  return segments.join(" & ");
}

/** Default load name: "M/d {Location} Load" — e.g. "6/22 Dodge City Load",
 *  or "6/22 NEK Load" when a load drops at multiple NEK towns. */
export function defaultLoadName(shipDate: Date, items: ShipmentItem[]): string {
  const date = format(shipDate, "M/d");
  const label = locationLabel(uniqueLocations(items));
  return label ? `${date} ${label} Load` : `${date} Load`;
}

/** Full multi-line summary (stops + every item) — used in the install card's
 *  notes / hover. */
export function shipmentSummary(load: ShipmentLoad): string {
  const stops = loadLocations(load).join(", ");
  const lines = load.items.map(
    (it) =>
      `${it.kind === "pickup" ? "[PICKUP] " : ""}` +
      `${it.jobNo ? it.jobNo + " — " : ""}${it.customerName}` +
      `${it.location ? " (" + it.location + ")" : ""}`,
  );
  return [stops ? `Stops: ${stops}` : "", ...lines].filter(Boolean).join("\n");
}

/** Concise one-line summary for the install card face. */
export function shipmentCardDesc(load: ShipmentLoad): string {
  const stops = loadLocations(load);
  const pickups = load.items.filter((i) => i.kind === "pickup").length;
  const parts: string[] = [];
  if (stops.length) parts.push(stops.join(", "));
  parts.push(`${load.items.length} item${load.items.length === 1 ? "" : "s"}`);
  if (pickups) parts.push(`${pickups} pickup`);
  return parts.join(" · ");
}
