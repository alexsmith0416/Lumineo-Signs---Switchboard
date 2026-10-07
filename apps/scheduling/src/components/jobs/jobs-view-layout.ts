// The Jobs view list — sections of saved views that people can add, rename,
// duplicate, delete and drag into any order, each with its own columns. Pure;
// JobsView persists it (per device, like the Airtable recreation app did).
import type { JobRow } from "../../services/job-tracking";
import { JOB_VIEW_GROUPS } from "./jobs-fields";

/** Built-in row limits a view can carry (a function can't be saved as JSON). */
export type ViewPreset = "untracked";

export interface ViewDef {
  id: string;
  name: string;
  cols: string[];
  defaultGroup?: string;
  preset?: ViewPreset;
  /** How many of the view's first columns stay put when scrolling sideways
   *  (the freeze line — freeze-line.ts). Absent = 1 (Job # / Name). Shared. */
  frozen?: number;
}

export interface ViewSection {
  id: string;
  label: string;
  viewIds: string[];
}

export interface ViewLayout {
  sections: ViewSection[];
  views: Record<string, ViewDef>;
}

export const PRESETS: Record<ViewPreset, (r: JobRow) => boolean> = {
  untracked: (r) => !r.tracked,
};

/** The starting layout — the built-in views, ids = names so saved prefs carry over. */
export function defaultLayout(): ViewLayout {
  const views: Record<string, ViewDef> = {};
  const sections = JOB_VIEW_GROUPS.map((g) => ({
    id: g.label,
    label: g.label,
    viewIds: g.views.map((v) => {
      views[v.name] = {
        id: v.name,
        name: v.name,
        cols: [...v.cols],
        ...(v.defaultGroup ? { defaultGroup: v.defaultGroup } : {}),
        ...(v.preset ? { preset: v.preset } : {}),
      };
      return v.name;
    }),
  }));
  return { sections, views };
}

/** A saved layout that no longer lines up (hand-edited, older app) → the default. */
export function sanitizeLayout(raw: unknown, knownFields: ReadonlySet<string>): ViewLayout {
  const l = raw as ViewLayout;
  if (!l || !Array.isArray(l.sections) || typeof l.views !== "object" || !l.views) return defaultLayout();
  const views: Record<string, ViewDef> = {};
  for (const [id, v] of Object.entries(l.views)) {
    if (!v || typeof v.name !== "string" || !Array.isArray(v.cols)) continue;
    // Custom field keys ("cf_…") are kept even before the fields have loaded.
    const cols = v.cols.filter((c) => knownFields.has(c) || c.startsWith("cf_"));
    const { frozen, ...rest } = v;
    views[id] = {
      ...rest,
      id,
      cols: cols.includes("job") ? cols : ["job", ...cols],
      ...(typeof frozen === "number" && frozen >= 1 ? { frozen: Math.round(frozen) } : {}),
    };
  }
  const seen = new Set<string>();
  const sections = l.sections
    .filter((s) => s && typeof s.label === "string" && Array.isArray(s.viewIds))
    .map((s) => ({
      id: String(s.id),
      label: s.label,
      viewIds: s.viewIds.filter((id) => views[id] && !seen.has(id) && seen.add(id)),
    }));
  // Views that lost their section land in the first one.
  const orphans = Object.keys(views).filter((id) => !seen.has(id));
  if (!sections.length) return defaultLayout();
  if (orphans.length) sections[0] = { ...sections[0]!, viewIds: [...sections[0]!.viewIds, ...orphans] };
  return Object.keys(views).length ? { sections, views } : defaultLayout();
}

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function findSection(l: ViewLayout, viewId: string): ViewSection | undefined {
  return l.sections.find((s) => s.viewIds.includes(viewId));
}

/** Add a view to a section (after `afterId` when given, else at the end). */
export function addView(l: ViewLayout, sectionId: string, base: Omit<ViewDef, "id">, afterId?: string): [ViewLayout, string] {
  const id = newId("v");
  const sections = l.sections.map((s) => {
    if (s.id !== sectionId) return s;
    const at = afterId ? s.viewIds.indexOf(afterId) + 1 : s.viewIds.length;
    const viewIds = [...s.viewIds];
    viewIds.splice(at > 0 ? at : viewIds.length, 0, id);
    return { ...s, viewIds };
  });
  return [{ sections, views: { ...l.views, [id]: { ...base, id } } }, id];
}

export function duplicateView(l: ViewLayout, viewId: string): [ViewLayout, string] {
  const v = l.views[viewId]!;
  const section = findSection(l, viewId)!;
  const { id: _id, ...rest } = v;
  return addView(l, section.id, { ...rest, name: `${v.name} copy`, cols: [...v.cols] }, viewId);
}

export function renameView(l: ViewLayout, viewId: string, name: string): ViewLayout {
  const trimmed = name.trim();
  if (!trimmed || !l.views[viewId]) return l;
  return { ...l, views: { ...l.views, [viewId]: { ...l.views[viewId]!, name: trimmed } } };
}

/** Delete a view. The last remaining view can't be deleted. */
export function deleteView(l: ViewLayout, viewId: string): ViewLayout {
  if (Object.keys(l.views).length <= 1) return l;
  const { [viewId]: _gone, ...views } = l.views;
  return { views, sections: l.sections.map((s) => ({ ...s, viewIds: s.viewIds.filter((id) => id !== viewId) })) };
}

/** Move a view to `index` within `toSectionId` (drag and drop). */
export function moveView(l: ViewLayout, viewId: string, toSectionId: string, index: number): ViewLayout {
  const from = findSection(l, viewId);
  if (!from || !l.sections.some((s) => s.id === toSectionId)) return l;
  let at = index;
  if (from.id === toSectionId && from.viewIds.indexOf(viewId) < index) at -= 1;
  const sections = l.sections.map((s) => ({ ...s, viewIds: s.viewIds.filter((id) => id !== viewId) })).map((s) => {
    if (s.id !== toSectionId) return s;
    const viewIds = [...s.viewIds];
    viewIds.splice(Math.max(0, Math.min(at, viewIds.length)), 0, viewId);
    return { ...s, viewIds };
  });
  return { ...l, sections };
}

export function setViewCols(l: ViewLayout, viewId: string, cols: string[]): ViewLayout {
  const v = l.views[viewId];
  if (!v) return l;
  const next = cols.includes("job") ? ["job", ...cols.filter((c) => c !== "job")] : ["job", ...cols];
  return { ...l, views: { ...l.views, [viewId]: { ...v, cols: next } } };
}

/** Freeze the view's first `n` columns (at least 1 — Job # / Name). */
export function setViewFrozen(l: ViewLayout, viewId: string, n: number): ViewLayout {
  const v = l.views[viewId];
  if (!v) return l;
  const frozen = Math.max(1, Math.round(n));
  if ((v.frozen ?? 1) === frozen) return l;
  return { ...l, views: { ...l.views, [viewId]: { ...v, frozen } } };
}

export function addSection(l: ViewLayout, label: string): [ViewLayout, string] {
  const id = newId("s");
  return [{ ...l, sections: [...l.sections, { id, label: label.trim() || "New section", viewIds: [] }] }, id];
}

export function renameSection(l: ViewLayout, sectionId: string, label: string): ViewLayout {
  const t = label.trim();
  return t ? { ...l, sections: l.sections.map((s) => (s.id === sectionId ? { ...s, label: t } : s)) } : l;
}

/** Delete a section; its views move to the section above (or below, if first). */
export function deleteSection(l: ViewLayout, sectionId: string): ViewLayout {
  if (l.sections.length <= 1) return l;
  const i = l.sections.findIndex((s) => s.id === sectionId);
  if (i < 0) return l;
  const moved = l.sections[i]!.viewIds;
  const target = i > 0 ? i - 1 : 1;
  const sections = l.sections
    .map((s, j) => (j === target ? { ...s, viewIds: [...s.viewIds, ...moved] } : s))
    .filter((s) => s.id !== sectionId);
  return { ...l, sections };
}

export function moveSection(l: ViewLayout, sectionId: string, index: number): ViewLayout {
  const i = l.sections.findIndex((s) => s.id === sectionId);
  if (i < 0) return l;
  const sections = [...l.sections];
  const [s] = sections.splice(i, 1);
  sections.splice(Math.max(0, Math.min(i < index ? index - 1 : index, sections.length)), 0, s!);
  return { ...l, sections };
}
