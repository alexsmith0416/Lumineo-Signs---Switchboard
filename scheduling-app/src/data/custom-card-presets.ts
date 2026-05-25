// Pre-made custom cards for blocking out time on the schedule. These
// don't tie back to a BC job — they're things like PTO, Inventory,
// Holidays, certs, etc. that consume an employee's time.

export interface CustomCardPreset {
  id: string;
  label: string;
  bgColor: string;
  textColor: string;
  /** Default duration in hours. 8 = a single day, 40 = a full week. */
  defaultHours: number;
  /** When true, cards created from this preset are locked by default so
   *  the cascade engine will never move them — a foreman's PTO or a
   *  shop-wide Holiday shouldn't shift just because an adjacent job moves. */
  lockByDefault?: boolean;
  /** When true, the "Apply to all employees" checkbox is on by default
   *  for this preset. Holiday hits everyone; PTO is per-person. */
  applyAllByDefault?: boolean;
}

export const CUSTOM_CARD_PRESETS: CustomCardPreset[] = [
  {
    id: "pto",
    label: "PTO",
    bgColor: "#FFC1D6", // pink
    textColor: "#6c1f3d",
    defaultHours: 8,
    lockByDefault: true,
  },
  {
    id: "inventory",
    label: "Inventory",
    bgColor: "#B8E5C4", // light green
    textColor: "#1b5b2b",
    defaultHours: 8,
    lockByDefault: true,
  },
  {
    id: "truck-maintenance",
    label: "Truck Maintenance",
    bgColor: "#1f5e2e", // dark green
    textColor: "#ffffff",
    defaultHours: 4,
    lockByDefault: true,
  },
  {
    id: "med-cert",
    label: "Med Cert",
    bgColor: "#4F7DD3", // blue
    textColor: "#ffffff",
    defaultHours: 2,
    lockByDefault: true,
  },
  {
    id: "dot-physical",
    label: "DOT Physical",
    bgColor: "#AED8F0", // light blue
    textColor: "#103e64",
    defaultHours: 2,
    lockByDefault: true,
  },
  {
    id: "crane-cert",
    label: "Crane Cert",
    bgColor: "#FF9248", // orange
    textColor: "#5c2d00",
    defaultHours: 4,
    lockByDefault: true,
  },
  {
    id: "holiday",
    label: "Holiday - Shop Closed",
    bgColor: "#FFD93D", // yellow
    textColor: "#5e4900",
    defaultHours: 8,
    lockByDefault: true,
    applyAllByDefault: true,
  },
];
