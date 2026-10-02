import { create } from "zustand";
import {
  BUILT_IN_CHECK_COLUMNS,
  addCheckOption,
  removeCheckOption,
  toggleCheckColumn,
} from "../shipping/print-columns";

/**
 * App-wide scheduling preferences (per device, persisted in localStorage).
 *
 * `cascadeEnabled` controls the conflict/cascade behavior. Default OFF: editing
 * a card (move / resize / hours) changes ONLY that card, nothing auto-moves, no
 * dialog appears, and the loaded board keeps its stored positions exactly
 * (overlaps just surface a conflict icon). When ON, moving/resizing a task that
 * would push others shows the cascade preview dialog and the board settles to a
 * conflict-free fixpoint on load. Toggle it in Settings.
 */
const CASCADE_KEY = "lumineo.settings.cascadeEnabled";
// Whether to hide the purple Power Apps player header. Default OFF (shown).
// The actual hide/show happens by reloading the app at the hideNavBar play URL
// (see services/power-host.ts) — this flag just remembers the preference. We
// can't read the cross-origin play URL, so the stored flag can drift from the
// real state; defaulting to "shown" matches the no-param URL you land on after a
// deploy, so a single toggle hides the header (no toggle-off-then-on dance).
const HIDE_HEADER_KEY = "lumineo.settings.hideHeader";
// Whether to draw the faint pulsing red "now" line at the current day + time on
// the calendars. Default ON.
const NOW_LINE_KEY = "lumineo.settings.showNowLine";
// Whether hovering a person's day shows the scheduled-hours readout pill
// ("6h of 8h · 2h open"). Default ON. Off for anyone who finds it distracting
// while dragging cards around, or on a wall display.
const DAY_HOURS_KEY = "lumineo.settings.showDayHours";
// Compact sidebar: a slim icon rail that widens to the full sidebar while the
// mouse is over it, giving the schedule more room. Default OFF (full sidebar).
const COMPACT_SIDEBAR_KEY = "lumineo.settings.compactSidebar";
// Open the calendars with Saturday and Sunday hidden. Default OFF (shown).
// Right-clicking a day header shows/hides them for the moment; this sets how
// the boards start.
const HIDE_WEEKEND_KEY = "lumineo.settings.hideWeekend";
// Hovering a day header pops up the $ scheduled that day (this board's region,
// the other region, combined). Default OFF.
const DAY_VALUE_KEY = "lumineo.settings.showDayValue";
// Tick-box columns on a shipping load's printed sheet: the library of column
// names the picker offers, and which of them currently print. Applies to every
// printed load (it's how YOUR sheet looks), not stored per load.
const PRINT_CHECK_OPTIONS_KEY = "lumineo.settings.printCheckOptions";
const PRINT_CHECK_COLUMNS_KEY = "lumineo.settings.printCheckColumns";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore disabled / quota-exceeded storage */
  }
}

/** Read a string list, tolerating anything a hand-edited/older value throws at
 *  us — a malformed entry must never keep the app from booting. */
function readList(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const list = parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    return list;
  } catch {
    return fallback;
  }
}

function writeList(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore disabled / quota-exceeded storage */
  }
}

/** The library always offers the built-ins, even if storage says otherwise. */
function withBuiltIns(options: string[]): string[] {
  let out = options;
  for (const b of BUILT_IN_CHECK_COLUMNS) out = addCheckOption(out, b);
  // Built-ins lead, in their canonical order, then whatever the user added.
  const custom = out.filter((o) => !BUILT_IN_CHECK_COLUMNS.some((b) => b.toLowerCase() === o.toLowerCase()));
  return [...BUILT_IN_CHECK_COLUMNS, ...custom];
}

interface SettingsState {
  cascadeEnabled: boolean;
  setCascadeEnabled: (value: boolean) => void;
  hideHeader: boolean;
  setHideHeader: (value: boolean) => void;
  showNowLine: boolean;
  setShowNowLine: (value: boolean) => void;
  showDayHours: boolean;
  setShowDayHours: (value: boolean) => void;
  compactSidebar: boolean;
  setCompactSidebar: (value: boolean) => void;
  /** Start the calendars with the weekend hidden (saved). */
  hideWeekendDefault: boolean;
  setHideWeekendDefault: (value: boolean) => void;
  showDayValue: boolean;
  setShowDayValue: (value: boolean) => void;
  /** Weekend hidden right now (right-click a day header; starts from the default). */
  hideWeekend: boolean;
  setHideWeekend: (value: boolean) => void;
  /** Column names the print picker offers (built-ins + the user's own). */
  printCheckOptions: string[];
  /** Which of them print, as tick-box columns. */
  printCheckColumns: string[];
  togglePrintCheckColumn: (label: string) => void;
  /** Add a column name to the library AND tick it (adding it is the intent). */
  addPrintCheckOption: (label: string) => void;
  removePrintCheckOption: (label: string) => void;
  // Presentation ("TV") mode hides the app's own top + side nav and shows the
  // current screen full-bleed for display on a monitor. Transient by design —
  // it's a mode you drop with ESC, not a saved preference — so it is NOT
  // persisted to localStorage and always starts off on load.
  presentationMode: boolean;
  setPresentationMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  cascadeEnabled: readBool(CASCADE_KEY, false),
  setCascadeEnabled: (value) => {
    writeBool(CASCADE_KEY, value);
    set({ cascadeEnabled: value });
  },
  hideHeader: readBool(HIDE_HEADER_KEY, false),
  setHideHeader: (value) => {
    writeBool(HIDE_HEADER_KEY, value);
    set({ hideHeader: value });
  },
  showNowLine: readBool(NOW_LINE_KEY, true),
  setShowNowLine: (value) => {
    writeBool(NOW_LINE_KEY, value);
    set({ showNowLine: value });
  },
  showDayHours: readBool(DAY_HOURS_KEY, true),
  setShowDayHours: (value) => {
    writeBool(DAY_HOURS_KEY, value);
    set({ showDayHours: value });
  },
  compactSidebar: readBool(COMPACT_SIDEBAR_KEY, false),
  setCompactSidebar: (value) => {
    writeBool(COMPACT_SIDEBAR_KEY, value);
    set({ compactSidebar: value });
  },
  hideWeekendDefault: readBool(HIDE_WEEKEND_KEY, false),
  setHideWeekendDefault: (value) => {
    writeBool(HIDE_WEEKEND_KEY, value);
    set({ hideWeekendDefault: value, hideWeekend: value });
  },
  showDayValue: readBool(DAY_VALUE_KEY, false),
  setShowDayValue: (value) => {
    writeBool(DAY_VALUE_KEY, value);
    set({ showDayValue: value });
  },
  hideWeekend: readBool(HIDE_WEEKEND_KEY, false),
  setHideWeekend: (value) => set({ hideWeekend: value }),
  printCheckOptions: withBuiltIns(readList(PRINT_CHECK_OPTIONS_KEY, BUILT_IN_CHECK_COLUMNS)),
  printCheckColumns: readList(PRINT_CHECK_COLUMNS_KEY, BUILT_IN_CHECK_COLUMNS),

  togglePrintCheckColumn: (label) => {
    const next = toggleCheckColumn(get().printCheckColumns, label);
    if (next === get().printCheckColumns) return; // at the cap
    writeList(PRINT_CHECK_COLUMNS_KEY, next);
    set({ printCheckColumns: next });
  },

  addPrintCheckOption: (label) => {
    const { printCheckOptions, printCheckColumns } = get();
    const options = addCheckOption(printCheckOptions, label);
    if (options === printCheckOptions) return; // blank or already there
    const added = options[options.length - 1]!;
    writeList(PRINT_CHECK_OPTIONS_KEY, options);
    // Tick it too — you added it because you want it on the sheet.
    const columns = toggleCheckColumn(printCheckColumns, added);
    writeList(PRINT_CHECK_COLUMNS_KEY, columns);
    set({ printCheckOptions: options, printCheckColumns: columns });
  },

  removePrintCheckOption: (label) => {
    const { printCheckOptions, printCheckColumns } = get();
    const options = removeCheckOption(printCheckOptions, label);
    if (options === printCheckOptions) return; // built-in or unknown
    const columns = printCheckColumns.filter((c) => c.toLowerCase() !== label.toLowerCase());
    writeList(PRINT_CHECK_OPTIONS_KEY, options);
    writeList(PRINT_CHECK_COLUMNS_KEY, columns);
    set({ printCheckOptions: options, printCheckColumns: columns });
  },

  presentationMode: false,
  setPresentationMode: (value) => set({ presentationMode: value }),
}));
