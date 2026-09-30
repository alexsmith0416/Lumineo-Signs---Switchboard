import { memo, useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import type { JobRow } from "../../services/job-tracking";
import DepartmentStepper from "../DepartmentStepper";
import { useJobSteps } from "../../hooks/useJobSteps";
import { BADGE_COLORS, JOB_FIELDS, badgeColor, type JobFieldDef } from "./jobs-fields";
import { contrastText, linkFor, optionColor, type CustomFieldDef } from "../../services/custom-fields";
import CustomValueEditor from "./CustomValueEditor";
import { allGroupPaths, buildGroupTree, flattenTree, type FlatItem, type GroupCriterion, type SortCriterion } from "./jobs-grid-state";

const ROW_H = 40;
const HEADER_H = 40;

export function JobBadge({ field, value }: { field: string; value: string }) {
  if (!value) return null;
  const c = BADGE_COLORS[badgeColor(field, value)];
  return (
    <span className="jobs-badge" style={{ background: c.bg, color: c.text }}>
      {value}
    </span>
  );
}

/** A custom Single / Multi Select value as coloured option badges. */
export function OptionBadges({ def, value }: { def: CustomFieldDef; value: string }) {
  const opts = value.split(",").map((v) => v.trim()).filter(Boolean);
  return (
    <>
      {opts.map((o) => {
        const bg = optionColor(def, o);
        return (
          <span key={o} className="jobs-badge jobs-badge--opt" style={{ background: bg, color: contrastText(bg) }}>
            {o}
          </span>
        );
      })}
    </>
  );
}

/** In-place editing for the grid (editors only): which columns take an editor,
 *  a cell's current value, and the save. */
export interface GridEditing {
  canEdit: boolean;
  /** The editor for a column, or null when it isn't editable. */
  editorFor: (col: JobFieldDef) => CustomFieldDef | null;
  valueFor: (row: JobRow, col: JobFieldDef) => unknown;
  onSave: (row: JobRow, col: JobFieldDef, value: unknown) => void;
}

/** Virtualised Jobs grid. Ported in spirit from the Airtable recreation app's
 *  Grid.tsx — same grouping / sorting / resizing. Click a row to open the job;
 *  editors edit the editable cells (tracking fields, dates, custom fields) in place. */
export default function JobsGrid({
  rows,
  cols,
  groups,
  sorts,
  onToggleSort,
  onOpen,
  widths,
  onWidths,
  autoWidths,
  collapseSignal,
  collapsed: collapsedPaths,
  onCollapsedChange,
  fieldsByKey,
  editing,
}: {
  rows: JobRow[];
  cols: JobFieldDef[];
  groups: GroupCriterion[];
  sorts: SortCriterion[];
  onToggleSort: (field: string) => void;
  /** Open a job's panel (row click). */
  onOpen: (row: JobRow) => void;
  /** Column widths, shared by every view (a resize applies everywhere). */
  widths: Record<string, number>;
  /** Widths used until a column is resized by hand (e.g. Job # / Name fits the longest name). */
  autoWidths?: Record<string, number>;
  onWidths: (next: Record<string, number>) => void;
  /** Bump .n to collapse (all=true) or expand (all=false) every group. */
  collapseSignal: { n: number; all: boolean };
  /** Paths of the collapsed groups — saved with the view. */
  collapsed: readonly string[];
  onCollapsedChange: (next: string[]) => void;
  /** Every field by key (built-in + custom), for group headers. */
  fieldsByKey?: ReadonlyMap<string, JobFieldDef>;
  editing?: GridEditing;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const collapsed = useMemo(() => new Set(collapsedPaths), [collapsedPaths]);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const onCollapsedRef = useRef(onCollapsedChange);
  onCollapsedRef.current = onCollapsedChange;
  // The custom-field cell being edited: `${jobNo}\u0000${fieldKey}`.
  const [openCell, setOpenCell] = useState<string | null>(null);
  const closeCell = useCallback(() => setOpenCell(null), []);
  // Live width while dragging; committed to the shared widths on mouse-up.
  const [dragging, setDragging] = useState<{ key: string; w: number } | null>(null);
  const widthOf = (key: string, fallback: number) =>
    dragging?.key === key ? dragging.w : widths[key] ?? autoWidths?.[key] ?? fallback;

  const tree = useMemo(() => (groups.length ? buildGroupTree(rows, groups) : null), [rows, groups]);

  // Collapse / expand every group when the toolbar asks (the signal's .n bumps).
  const treeRef = useRef(tree);
  treeRef.current = tree;
  useEffect(() => {
    if (collapseSignal.n === 0) return;
    const t = treeRef.current;
    onCollapsedRef.current(collapseSignal.all && t ? allGroupPaths(t) : []);
  }, [collapseSignal]);

  const items = useMemo<FlatItem[]>(
    () => (tree ? flattenTree(tree, collapsed) : rows.map((row) => ({ kind: "row" as const, row }))),
    [tree, rows, collapsed],
  );

  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => wrapRef.current,
    estimateSize: (i) => (items[i]?.kind === "header" ? HEADER_H : ROW_H),
    overscan: 8,
  });

  const toggle = useCallback((path: string) => {
    const next = new Set(collapsedRef.current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    // Update the ref now, so a second click before the re-render builds on this one.
    collapsedRef.current = next;
    startTransition(() => onCollapsedRef.current([...next]));
  }, []);

  const startResize = (e: React.MouseEvent, key: string, start: number) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    let last = start;
    const move = (m: MouseEvent) => {
      last = Math.max(50, start + m.clientX - x0);
      setDragging({ key, w: last });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      setDragging(null);
      onWidths({ ...widths, [key]: last });
    };
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const vItems = virt.getVirtualItems();
  const padTop = vItems[0]?.start ?? 0;
  const padBot = vItems.length ? virt.getTotalSize() - vItems[vItems.length - 1]!.end : 0;

  return (
    <div className="jobs-grid-wrap" ref={wrapRef}>
      {/* An exact width (the sum of the columns) keeps table-layout: fixed in charge,
          so a column is the width it's set to on every row — not sized by the text
          of whichever rows are on screen. */}
      <table className="jobs-grid" style={{ width: cols.reduce((sum, c) => sum + widthOf(c.key, c.width), 0) }}>
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={{ width: widthOf(c.key, c.width) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => {
              const si = sorts.findIndex((s) => s.field === c.key);
              const sortable = c.type !== "stepper";
              return (
                <th
                  key={c.key}
                  className={sortable ? "jobs-th--sortable" : undefined}
                  onClick={sortable ? () => onToggleSort(c.key) : undefined}
                  title={sortable ? "Click to sort" : undefined}
                >
                  <span className="jobs-th__label">{c.label}</span>
                  {si >= 0 && <span className="jobs-th__sort">{sorts[si]!.asc ? "▲" : "▼"}</span>}
                  <span
                    className="jobs-th__resize"
                    onMouseDown={(e) => startResize(e, c.key, widthOf(c.key, c.width))}
                    title="Drag to resize · double-click to reset"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const n = { ...widths };
                      delete n[c.key];
                      onWidths(n);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={cols.length} style={{ height: padTop, padding: 0, border: "none" }} />
            </tr>
          )}
          {vItems.map((vi) => {
            const item = items[vi.index];
            if (!item) return null;
            if (item.kind === "header") {
              const n = item.node;
              const isCollapsed = collapsed.has(n.path);
              const def = fieldsByKey?.get(n.field) ?? JOB_FIELDS[n.field];
              return (
                <tr key={`g:${n.path}`} className={`jobs-group jobs-group--d${n.depth}`} onClick={() => toggle(n.path)}>
                  <td colSpan={cols.length}>
                    <div className="jobs-group__inner" style={{ paddingLeft: 8 + n.depth * 20 }}>
                      <span className={`jobs-group__chev${isCollapsed ? " jobs-group__chev--closed" : ""}`}>▾</span>
                      <span className="jobs-group__field">{def?.label ?? n.field}</span>
                      {def?.type === "badge" ? (
                        <JobBadge field={n.field} value={n.key} />
                      ) : def?.custom && def.type === "select" && n.key !== "—" ? (
                        <OptionBadges def={def.custom} value={n.key} />
                      ) : (
                        <span className="jobs-group__value">{n.key}</span>
                      )}
                      <span className="jobs-group__count">{n.count}</span>
                    </div>
                  </td>
                </tr>
              );
            }
            const prefix = `${item.row.jobNo}\u0000`;
            return (
              <JobGridRow
                key={item.row.id}
                row={item.row}
                cols={cols}
                onOpen={onOpen}
                openKey={openCell?.startsWith(prefix) ? openCell.slice(prefix.length) : null}
                onOpenCell={setOpenCell}
                onCloseCell={closeCell}
                editing={editing}
              />
            );
          })}
          {padBot > 0 && (
            <tr aria-hidden="true">
              <td colSpan={cols.length} style={{ height: padBot, padding: 0, border: "none" }} />
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && <div className="jobs-empty">No jobs match.</div>}
    </div>
  );
}

const JobGridRow = memo(function JobGridRow({
  row,
  cols,
  onOpen,
  openKey,
  onOpenCell,
  onCloseCell,
  editing,
}: {
  row: JobRow;
  cols: JobFieldDef[];
  onOpen: (row: JobRow) => void;
  /** The custom field key being edited in this row, if any. */
  openKey: string | null;
  onOpenCell: (cell: string) => void;
  onCloseCell: () => void;
  editing?: GridEditing;
}) {
  return (
    <tr className={`jobs-row${row.tracked ? "" : " jobs-row--untracked"}`} onClick={() => onOpen(row)}>
      {cols.map((c) => {
        const cf = editing?.canEdit ? editing.editorFor(c) : null;
        const editable = !!cf && cf.type !== "formula-date";
        const isOpen = editable && openKey === c.key;
        const cls = [
          c.key === "job" ? "jobs-cell--primary" : "",
          editable ? "jobs-cell--editable" : "",
          isOpen ? "jobs-cell--editing" : "",
        ].filter(Boolean).join(" ");
        return (
          <td
            key={c.key}
            className={cls || undefined}
            onClick={
              editable
                ? (e) => {
                    e.stopPropagation();
                    if (cf!.type === "bool") {
                      editing!.onSave(row, c, !(editing!.valueFor(row, c) === true));
                    } else if (!isOpen) onOpenCell(`${row.jobNo}\u0000${c.key}`);
                  }
                : undefined
            }
          >
            {isOpen ? (
              <div className="jobs-cell__editor">
                <CustomValueEditor
                  inline
                  def={cf!}
                  value={editing!.valueFor(row, c)}
                  onSave={(v) => editing!.onSave(row, c, v)}
                  onDone={onCloseCell}
                />
              </div>
            ) : (
              <Cell row={row} def={c} />
            )}
          </td>
        );
      })}
    </tr>
  );
});

function Cell({ row, def }: { row: JobRow; def: JobFieldDef }) {
  if (def.type === "stepper") return <StepperCell jobNo={row.inBc ? row.jobNo : undefined} />;
  const v = (row as unknown as Record<string, unknown>)[def.key];
  switch (def.type) {
    case "badge":
      return (
        <>
          <JobBadge field={def.key} value={String(v ?? "")} />
          {def.key === "status" && row.statusSource === "override" && <span className="jobs-tag" title="Manual status override">override</span>}
        </>
      );
    case "date": {
      const s = String(v ?? "");
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      return <span>{m ? format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), "M/d/yyyy") : ""}</span>;
    }
    case "currency":
      return <span className="jobs-num">{typeof v === "number" ? `$${Math.round(v).toLocaleString("en-US")}` : ""}</span>;
    case "days": {
      if (typeof v !== "number") return null;
      const c = BADGE_COLORS[v > 60 ? "red" : v > 40 ? "orange" : "blue"];
      return <span className="jobs-badge" style={{ background: c.bg, color: c.text }}>{v}d</span>;
    }
    case "bool":
      return v ? <span className="jobs-check" aria-label="Yes">✓</span> : null;
    case "number":
      return <span className="jobs-num">{typeof v === "number" ? v.toLocaleString("en-US") : ""}</span>;
    case "select":
      return def.custom ? <OptionBadges def={def.custom} value={String(v ?? "")} /> : null;
    case "link": {
      const s = String(v ?? "");
      const href = def.custom ? linkFor(def.custom.type, s) : "";
      return href ? (
        <a
          className="jobs-link"
          href={href}
          target={def.custom?.type === "url" ? "_blank" : undefined}
          rel="noreferrer"
          title={s}
          onClick={(e) => e.stopPropagation()}
        >
          {s}
        </a>
      ) : (
        <span>{s}</span>
      );
    }
    default: {
      const s = String(v ?? "");
      return (
        <span className={def.type === "multiline" ? "jobs-clip" : undefined} title={s.length > 40 ? s : undefined}>
          {s}
          {def.key === "job" && !row.inBc && <span className="jobs-tag jobs-tag--warn" title="This job isn't in the BC job sync">not in BC</span>}
        </span>
      );
    }
  }
}

/** The job's production stepper — its steps load lazily per visible row. */
function StepperCell({ jobNo }: { jobNo: string | undefined }) {
  const { steps } = useJobSteps(jobNo);
  if (!steps.length) return null;
  return <DepartmentStepper steps={steps} size="sm" />;
}
