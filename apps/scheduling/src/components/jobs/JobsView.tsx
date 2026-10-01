import { useEffect, useMemo, useState } from "react";
import { useJobTrackingStore } from "../../store/job-tracking-store";
import { useJobScheduleStore } from "../../store/job-schedule-store";
import { buildJobRows, type JobRow, type JobScheduleDates } from "../../services/job-tracking";
import JobsGrid from "./JobsGrid";
import JobsJobPanel from "./JobsJobPanel";
import { useLeadTimeStore } from "../../store/lead-time-store";
import { useJobDeptOverrideStore } from "../../store/job-dept-override-store";
import { leadTimeFor } from "../../services/lead-times";
import { includedStepDefs } from "../../services/production-steps";
import JobsViewList from "./JobsViewList";
import { FieldsPanel, FilterPanel, GroupPanel, SortPanel } from "./JobsPanels";
import { JOB_FIELDS, customColumn, type JobFieldDef } from "./jobs-fields";
import { withCustomFields } from "../../services/custom-fields";
import { useCustomFieldStore } from "../../store/custom-field-store";
import { AddFieldsDialog, EditFieldDialog } from "./CustomFieldDialogs";
import { BUILTIN_EDITS, localDate, trackValue } from "./jobs-editable";
import { useCurrentUser } from "../../services/current-user";
import { cleanPrefs, useJobsViewsStore } from "../../store/jobs-views-store";
import { useSketchStore } from "../../store/sketch-store";
import { applyGrid, type GridPrefs } from "./jobs-grid-state";
import {
  PRESETS, addSection, addView, deleteSection, deleteView, duplicateView, moveSection, moveView,
  renameSection, renameView, setViewCols,
} from "./jobs-view-layout";

/**
 * Jobs — every open BC job with its tracking fields and stepper. Replaces the
 * Airtable "LNI Production Schedule / Expeditor" list. The views (sections,
 * names, order, columns) and each view's sorts / filters / groups / collapsed
 * groups are SHARED by everyone (store/jobs-views-store.ts). Column widths and
 * the view you last had open are saved on this device.
 */
const WIDTHS_KEY = "lumineo.jobs.colWidths.v1";
const LAST_VIEW_KEY = "lumineo.jobs.lastView";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // private window / blocked storage
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* non-critical */
  }
}


type Panel = "fields" | "filter" | "sort" | "group" | null;

const ymd = (d: Date | null | undefined): string =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";

const KNOWN_FIELDS = new Set(Object.keys(JOB_FIELDS));

export default function JobsView({ canSeeMoney, canEdit }: { canSeeMoney: boolean; canEdit: boolean }) {
  const bcJobs = useJobTrackingStore((s) => s.bcJobs);
  const tracks = useJobTrackingStore((s) => s.tracks);
  const invoiceByJob = useJobTrackingStore((s) => s.invoiceByJob);
  const stepInfo = useJobTrackingStore((s) => s.stepInfo);
  const leadRules = useLeadTimeStore((s) => s.rules);
  const loadLeadRules = useLeadTimeStore((s) => s.load);
  const deptOverrides = useJobDeptOverrideStore((s) => s.byJob);
  const loadDeptOverrides = useJobDeptOverrideStore((s) => s.load);
  const loading = useJobTrackingStore((s) => s.loading);
  const loaded = useJobTrackingStore((s) => s.loaded);
  const error = useJobTrackingStore((s) => s.error);
  const load = useJobTrackingStore((s) => s.load);
  const setCustomValue = useJobTrackingStore((s) => s.setCustomValue);
  const updateTrack = useJobTrackingStore((s) => s.updateTrack);
  const setStatus = useJobTrackingStore((s) => s.setStatus);
  const updateSchedule = useJobScheduleStore((s) => s.update);
  const { fullName, upn } = useCurrentUser();
  const me = fullName || upn || "Unknown";
  const customDefs = useCustomFieldStore((s) => s.defs);
  const sketches = useSketchStore((s) => s.byJob);
  const loadSketches = useSketchStore((s) => s.load);
  const loadCustomDefs = useCustomFieldStore((s) => s.load);
  // Dates come from the SAME job-schedule store the boards' Install Dates use,
  // so an edit anywhere shows here at once (and here → the boards).
  const scheduleByJob = useJobScheduleStore((s) => s.byJob);
  const loadSchedules = useJobScheduleStore((s) => s.load);
  useEffect(() => {
    void load();
    void loadSchedules();
    void loadLeadRules();
    void loadDeptOverrides();
    void loadCustomDefs();
    void loadSketches();
  }, [load, loadSchedules, loadLeadRules, loadDeptOverrides, loadCustomDefs, loadSketches]);

  const rows = useMemo(() => {
    const dates = new Map<string, JobScheduleDates>();
    for (const [jobNo, sch] of Object.entries(scheduleByJob)) {
      dates.set(jobNo, {
        redDate: ymd(sch.redDate),
        productionCompleteDate: ymd(sch.productionCompleteDate),
        releasedDate: ymd(sch.releasedDate),
        scheduledInstallDate: ymd(sch.scheduledInstallDate),
      });
    }
    // Each job's lead time follows its stepper steps (lead-time rules, Settings).
    const leadFor = (jobNo: string) => {
      const info = stepInfo.get(jobNo);
      const keys = info ? includedStepDefs(info.production, info.hasInstall, deptOverrides[jobNo] ?? {}).map((d) => d.key) : [];
      return leadTimeFor(keys, leadRules);
    };
    const built = buildJobRows(bcJobs, tracks, dates, new Date(), invoiceByJob, leadFor);
    // Custom field values ride on each row under the field's key, so search /
    // filter / sort / group treat them like any other column.
    const valuesByJob = new Map(tracks.map((t) => [t.jobNo, t.customValues]));
    // The sketch's file name rides on the row, so "Sketch is empty / not empty" filters work.
    const withSketch = sketches.size ? built.map((r) => ({ ...r, sketch: sketches.get(r.jobNo)?.fileName ?? "" })) : built;
    return withCustomFields(withSketch, customDefs, (jobNo) => valuesByJob.get(jobNo));
  }, [bcJobs, tracks, scheduleByJob, invoiceByJob, stepInfo, deptOverrides, leadRules, customDefs, sketches]);
  const [openJob, setOpenJob] = useState<JobRow | null>(null);
  const [addingField, setAddingField] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // ── Views (editable, shared by everyone) ─────────────────────────────────
  const layout = useJobsViewsStore((s) => s.layout);
  const setLayout = useJobsViewsStore((s) => s.setLayout);
  const prefsByView = useJobsViewsStore((s) => s.prefsByView);
  const setViewPrefs = useJobsViewsStore((s) => s.setPrefs);
  const loadViews = useJobsViewsStore((s) => s.load);
  useEffect(() => {
    void loadViews(KNOWN_FIELDS);
  }, [loadViews]);
  const [viewId, setViewId] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_VIEW_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const firstViewId = layout.sections.flatMap((s) => s.viewIds)[0]!;
  const view = layout.views[viewId] ?? layout.views[firstViewId]!;

  const prefs: GridPrefs = prefsByView[view.id] ?? cleanPrefs(null, view);
  const [widths, setWidthsState] = useState<Record<string, number>>(() => read(WIDTHS_KEY) ?? {});
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [collapseSignal, setCollapseSignal] = useState({ n: 0, all: false });

  const pickView = (id: string) => {
    const v = layout.views[id];
    if (!v) return;
    setViewId(id);
    setPanel(null);
    write(LAST_VIEW_KEY, id);
  };
  const setPrefs = (patch: Partial<GridPrefs>) => setViewPrefs(view.id, { ...prefs, ...patch });
  const setWidths = (next: Record<string, number>) => {
    setWidthsState(next);
    write(WIDTHS_KEY, next);
  };

  // Built-in columns + custom fields, by key.
  const fieldsByKey = useMemo(() => {
    const m = new Map<string, JobFieldDef>(Object.entries(JOB_FIELDS));
    for (const d of customDefs) m.set(d.key, customColumn(d));
    return m;
  }, [customDefs]);
  const cols = useMemo(
    () => view.cols.map((k) => fieldsByKey.get(k)).filter((d): d is JobFieldDef => !!d && (!d.money || canSeeMoney)),
    [view, canSeeMoney, fieldsByKey],
  );
  const allFields = useMemo(
    () => [...fieldsByKey.values()].filter((d) => !d.money || canSeeMoney),
    [canSeeMoney, fieldsByKey],
  );
  const tracksByJob = useMemo(() => new Map(tracks.map((t) => [t.jobNo, t])), [tracks]);
  // In-place editing: custom fields, plus the built-in columns in jobs-editable.ts.
  const gridEditing = useMemo(
    () => ({
      canEdit,
      editorFor: (col: JobFieldDef) => col.custom ?? BUILTIN_EDITS[col.key]?.field ?? null,
      valueFor: (row: JobRow, col: JobFieldDef) =>
        col.custom
          ? tracksByJob.get(row.jobNo)?.customValues?.[col.key]
          : (row as unknown as Record<string, unknown>)[col.key],
      onSave: (row: JobRow, col: JobFieldDef, value: unknown) => {
        if (col.custom) return void setCustomValue(row.jobNo, col.key, value);
        const target = BUILTIN_EDITS[col.key];
        if (!target) return;
        if (target.kind === "status") {
          if (typeof value === "string" && value) void setStatus(row.jobNo, value, me);
        } else if (target.kind === "schedule") {
          void updateSchedule(row.jobNo, { [target.schedKey]: localDate(value) });
        } else {
          void updateTrack(row.jobNo, { [target.trackKey]: trackValue(target, value) });
        }
      },
    }),
    [canEdit, tracksByJob, setCustomValue, setStatus, updateSchedule, updateTrack, me],
  );

  // Job # / Name fits the longest name in the list until it's resized by hand.
  const autoWidths = useMemo(() => ({ job: fitJobColumn(rows) }), [rows]);
  const inView = useMemo(() => (view.preset ? rows.filter(PRESETS[view.preset]) : rows), [rows, view]);
  const shown = useMemo(() => applyGrid(inView, search, prefs), [inView, search, prefs]);

  const toggleSort = (field: string) => {
    const cur = prefs.sorts.find((s) => s.field === field);
    setPrefs({ sorts: !cur ? [{ field, asc: true }] : cur.asc ? [{ field, asc: false }] : [] });
  };

  const counts = { fields: 0, filter: prefs.filters.length, sort: prefs.sorts.length, group: prefs.groups.length };
  const LABELS = { fields: "Fields", filter: "Filter", sort: "Sort", group: "Group" } as const;

  return (
    <div className="jobs-view" onClick={() => setPanel(null)}>
      <JobsViewList
        layout={layout}
        activeId={view.id}
        onSelect={pickView}
        onAddView={(sectionId) => {
          const [next, id] = addView(layout, sectionId, { name: "New view", cols: [...view.cols] });
          setLayout(next);
          setViewId(id);
          write(LAST_VIEW_KEY, id);
        }}
        onDuplicate={(id) => {
          const [next, copy] = duplicateView(layout, id);
          setLayout(next);
          setViewPrefs(copy, prefsByView[id] ?? cleanPrefs(null, layout.views[id]));
          setViewId(copy);
          write(LAST_VIEW_KEY, copy);
        }}
        onRename={(id, name) => setLayout(renameView(layout, id, name))}
        onDelete={(id) => {
          const next = deleteView(layout, id);
          setLayout(next);
          if (id === view.id) {
            const first = next.sections.flatMap((s) => s.viewIds)[0]!;
            setViewId(first);
            write(LAST_VIEW_KEY, first);
          }
        }}
        onMoveView={(id, sectionId, index) => setLayout(moveView(layout, id, sectionId, index))}
        onAddSection={() => setLayout(addSection(layout, "New section")[0])}
        onRenameSection={(id, label) => setLayout(renameSection(layout, id, label))}
        onDeleteSection={(id) => {
          const s = layout.sections.find((x) => x.id === id);
          if (s && window.confirm(`Delete the section "${s.label}"? Its views move to the section above.`)) {
            setLayout(deleteSection(layout, id));
          }
        }}
        onMoveSection={(id, index) => setLayout(moveSection(layout, id, index))}
      />

      <section className="jobs-main">
        <div className="jobs-toolbar">
          <input
            className="jobs-toolbar__search"
            type="search"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {(["fields", "filter", "sort", "group"] as const).map((p) => (
            <div key={p} className="jobs-toolbar__btn-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`jobs-toolbar__btn${counts[p] ? " jobs-toolbar__btn--on" : ""}`}
                onClick={() => setPanel(panel === p ? null : p)}
              >
                {LABELS[p]}
                {counts[p] > 0 && <span className="jobs-toolbar__count">{counts[p]}</span>}
              </button>
              {panel === "fields" && p === "fields" && (
                <FieldsPanel fields={allFields} cols={view.cols}
                  onChange={(next) => setLayout(setViewCols(layout, view.id, next))} onClose={() => setPanel(null)}
                  onAddField={canEdit ? () => { setPanel(null); setAddingField(true); } : undefined}
                  onEditField={canEdit ? (key) => { setPanel(null); setEditingField(key); } : undefined} />
              )}
              {panel === "filter" && p === "filter" && (
                <FilterPanel fields={allFields} filters={prefs.filters} rows={inView}
                  onChange={(filters) => setPrefs({ filters })} onClose={() => setPanel(null)} />
              )}
              {panel === "sort" && p === "sort" && (
                <SortPanel fields={allFields} sorts={prefs.sorts} onChange={(sorts) => setPrefs({ sorts })} onClose={() => setPanel(null)} />
              )}
              {panel === "group" && p === "group" && (
                <GroupPanel fields={allFields} groups={prefs.groups} onChange={(groups) => setPrefs({ groups })}
                  onClose={() => setPanel(null)}
                  onCollapseAll={() => setCollapseSignal((s) => ({ n: s.n + 1, all: true }))}
                  onExpandAll={() => setCollapseSignal((s) => ({ n: s.n + 1, all: false }))} />
              )}
            </div>
          ))}
          <span className="jobs-toolbar__meta">
            {loading && !loaded ? "Loading jobs…" : `${shown.length.toLocaleString()} of ${inView.length.toLocaleString()} jobs`}
          </span>
          <span className="jobs-toolbar__spring" />
          <span className="jobs-toolbar__note">Click a job to open it</span>
          <button type="button" className="jobs-toolbar__btn" onClick={() => { void load(true); void loadSchedules(true); void loadSketches(true); }} disabled={loading}>
            Refresh
          </button>
        </div>
        {error && <div className="jobs-error">Couldn't load jobs: {error}</div>}
        <JobsGrid rows={shown} cols={cols} groups={prefs.groups} sorts={prefs.sorts} onToggleSort={toggleSort}
          collapseSignal={collapseSignal} onOpen={setOpenJob} widths={widths} onWidths={setWidths} autoWidths={autoWidths}
          fieldsByKey={fieldsByKey} editing={gridEditing}
          collapsed={prefs.collapsed ?? []} onCollapsedChange={(collapsed) => setPrefs({ collapsed })} />
      </section>
      {addingField && (
        <AddFieldsDialog
          onAdded={(keys) => setLayout(setViewCols(layout, view.id, [...view.cols, ...keys]))}
          onClose={() => setAddingField(false)}
        />
      )}
      {editingField && <EditFieldDialog fieldKey={editingField} onClose={() => setEditingField(null)} />}
      {openJob && (
        <JobsJobPanel
          row={rows.find((r) => r.jobNo === openJob.jobNo) ?? openJob}
          canEdit={canEdit}
          onClose={() => setOpenJob(null)}
        />
      )}
    </div>
  );
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** Width that fits the longest "J12345 Customer Name" (the grid's 600-weight
 *  12px text + padding, and room for a "not in BC" tag), within 180–520 px. */
function fitJobColumn(rows: readonly JobRow[]): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = `600 12px ${getComputedStyle(document.body).fontFamily}`;
  }
  let widest = 0;
  for (const r of rows) {
    const w = (measureCtx ? measureCtx.measureText(r.job).width : r.job.length * 7) + (r.inBc ? 0 : 76);
    if (w > widest) widest = w;
  }
  return Math.min(520, Math.max(180, Math.ceil(widest + 24)));
}
