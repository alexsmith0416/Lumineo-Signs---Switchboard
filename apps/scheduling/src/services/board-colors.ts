// Board colours (Oct 17, 2026) — the card + banner colours of each production
// department and install location, editable with "Modify colors…" on a banner
// (Admin / Ops). Shared by everyone: one entry in the Jobs views config table
// (store/board-colors-store.ts). Pure — no I/O.

import type { Department } from "../engine/types";
import { contrastText } from "./custom-fields";

/** One department's / location's colours. */
export interface ColorScheme {
  /** Card background. */
  bg: string;
  /** Card text. */
  text: string;
  /** Banner (department / location header) background. */
  header: string;
  /** Banner text. */
  headerText: string;
}

/** A saved, named scheme to apply again later. */
export interface NamedScheme extends ColorScheme {
  name: string;
}

/** Which board's groups: production departments, or install locations (both regions). */
export type ColorScope = "production" | "installation";

export interface BoardColors {
  production: Record<string, ColorScheme>;
  installation: Record<string, ColorScheme>;
  schemes: NamedScheme[];
}

export const EMPTY_BOARD_COLORS: BoardColors = { production: {}, installation: {}, schemes: [] };

const GRAY = "#cccccc";

// The house palette (CLAUDE.md) with its matching dark text.
const PALETTE_TEXT: Record<string, string> = {
  "#BED7FF": "#042c53",
  "#FAC775": "#633806",
  "#CECBF6": "#26215c",
  "#C8E6D4": "#04342c",
  "#FFE0A8": "#5e3c00",
  "#D6DCE5": "#1c2533",
  "#F8D5B7": "#5b2a00",
};

// Live production departments have no colour column yet (all gray): give the
// known departments their house colour by name.
const BY_NAME: Array<[RegExp, string]> = [
  [/metal|fab|weld/i, "#BED7FF"],
  [/paint|finish/i, "#FAC775"],
  [/assembl|electric|wir/i, "#CECBF6"],
  [/vinyl|graphic|print|digital/i, "#C8E6D4"],
  [/install/i, "#FFE0A8"],
  [/rout|cnc|cut/i, "#D6DCE5"],
  [/crat|ship|pack/i, "#F8D5B7"],
];

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/** Text colour that reads on `bg`: the palette's own, else black/white by contrast. */
export function textFor(bg: string): string {
  return PALETTE_TEXT[bg.toUpperCase()] ?? PALETTE_TEXT[bg] ?? contrastText(bg);
}

/** A department's colours before anyone edits them. */
export function defaultScheme(dept: Pick<Department, "name" | "color">): ColorScheme {
  let bg = dept.color && dept.color.toLowerCase() !== GRAY ? dept.color : "";
  if (!bg) bg = BY_NAME.find(([re]) => re.test(dept.name))?.[1] ?? GRAY;
  const text = bg === GRAY ? "#222222" : textFor(bg);
  return { bg, text, header: bg, headerText: text };
}

/** The colours a department shows with: its edited scheme, else the default. */
export function schemeFor(
  colors: BoardColors,
  scope: ColorScope,
  dept: Pick<Department, "id" | "name" | "color">,
): ColorScheme {
  return colors[scope][dept.id] ?? defaultScheme(dept);
}

/** Departments with their colours applied (card bg in `color`, the rest alongside). */
export function applyBoardColors(
  departments: ReadonlyMap<string, Department>,
  scope: ColorScope,
  colors: BoardColors,
): Map<string, Department> {
  const out = new Map<string, Department>();
  for (const [id, d] of departments) {
    const s = schemeFor(colors, scope, d);
    out.set(id, { ...d, color: s.bg, textColor: s.text, headerColor: s.header, headerTextColor: s.headerText });
  }
  return out;
}

function cleanScheme(v: unknown): ColorScheme | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isHex(o.bg)) return null;
  const text = isHex(o.text) ? o.text : textFor(o.bg);
  const header = isHex(o.header) ? o.header : o.bg;
  return { bg: o.bg, text, header, headerText: isHex(o.headerText) ? o.headerText : textFor(header) };
}

/** The stored config → BoardColors (anything malformed is dropped). */
export function parseBoardColors(raw: unknown): BoardColors {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BOARD_COLORS, schemes: [] };
  const o = raw as Record<string, unknown>;
  const scope = (v: unknown): Record<string, ColorScheme> => {
    const out: Record<string, ColorScheme> = {};
    if (v && typeof v === "object") {
      for (const [k, s] of Object.entries(v as Record<string, unknown>)) {
        const c = cleanScheme(s);
        if (c) out[k] = c;
      }
    }
    return out;
  };
  const schemes: NamedScheme[] = [];
  if (Array.isArray(o.schemes)) {
    for (const s of o.schemes) {
      const c = cleanScheme(s);
      const name = s && typeof s === "object" ? String((s as Record<string, unknown>).name ?? "").trim() : "";
      if (c && name && !schemes.some((x) => x.name.toLowerCase() === name.toLowerCase())) schemes.push({ name, ...c });
    }
  }
  return { production: scope(o.production), installation: scope(o.installation), schemes };
}
