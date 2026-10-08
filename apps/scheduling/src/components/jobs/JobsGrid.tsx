import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import type { JobRow } from "../../services/job-tracking";
import DepartmentStepper from "../DepartmentStepper";
import { useJobSteps } from "../../hooks/useJobSteps";
import { useSketchStore } from "../../store/sketch-store";
import { BADGE_COLORS, JOB_FIELDS, badgeColor, type JobFieldDef } from "./jobs-fields";
import { contrastText, linkFor, optionColor, type CustomFieldDef } from "../../services/custom-fields";
import CustomValueEditor from "./CustomValueEditor";
import StepperPopover from "./StepperPopover";
import SketchPicker from "./SketchPicker";
import SketchViewer, { RemoveSketchConfirm } from "./SketchViewer";
import { createPortal } from "react-dom";
import { bcJobUrl, sharepointJobUrl } from "../../services/job-links";
import { allGroupPaths, buildGroupTree, flattenTree, type FlatItem, type GroupCriterion, type OptionOrder, type SortCriterion } from "./jobs-grid-state";
import { builtinStyle, splitMulti, type OptionStyle } from "./field-options";
import { effectiveFrozen, frozenOffsets, lineX, nearestFrozen } from "./freeze-line";
import { useFieldOptionsStore } from "../../store/field-options-store";
import { AutoStatusTag } from "./ShopFloorHistory";

const ROW_H = 40;
const HEADER_H = 40;

export function JobBadge({ field, value }: { field: string; value: string }) {
  // Colours edited with "Edit field…" on the column header win over the defaults.
  const override = useFieldOptionsStore((s) => s.overrides[field]);
  if (!value) return null;
  const c = override ? builtinStyle(field, value, override) : BADGE_COLORS[badgeColor(field, value)];
  return (
    <span className="jobs-badge" style={{ background: c.bg, color: c.text }}>
      {value}
    </span>
  );
}

/** Sketch cells: editors can change / upload a job's sketch. */
const SketchEditContext = createContext<{ canEdit: boolean; openPicker: (row: JobRow) => void }>({
  canEdit: false,
  openPicker: () => {},
});

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
  /** Any edit at all (full editor, or at least one granted field). */
  canEdit: boolean;
  /** May this login change the field with this key (Sketch / Stepper included)? */
  canEditField: (key: string) => boolean;
  /** The editor for a column, or null when it isn't editable. */
  editorFor: (col: JobFieldDef) => CustomFieldDef | null;
  valueFor: (row: JobRow, col: JobFieldDef) => unknown;
  onSave: (row: JobRow, col: JobFieldDef, value: unknown) => void;
  /** A choice column's option colours (for the dropdown). */
  styleOf?: (col: JobFieldDef, value: string) => OptionStyle;
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
  orderOf,
  onEditField,
  canEditField,
  frozen = 1,
  onFrozenChange,
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
  /** Choice columns' option order — groups follow it. */
  orderOf?: OptionOrder;
  /** Right-click a header → "Edit field…" (name; options / type where it has them). */
  onEditField?: (col: JobFieldDef) => void;
  canEditField?: (col: JobFieldDef) => boolean;
  /** How many of the first columns stay put when scrolling sideways (the view's). */
  frozen?: number;
  /** Editors: the freeze line was dragged to freeze this many columns. Absent = can't drag. */
  onFrozenChange?: (n: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Horizontal scroll + visible width, for the freeze line.
  const [scrollLeft, setScrollLeft] = useState(0);
  const [visibleWidth, setVisibleWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onScroll = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => setVisibleWidth(el.clientWidth));
    ro.observe(el);
    setVisibleWidth(el.clientWidth);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);
  const collapsed = useMemo(() => new Set(collapsedPaths), [collapsedPaths]);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const onCollapsedRef = useRef(onCollapsedChange);
  onCollapsedRef.current = onCollapsedChange;
  // The custom-field cell being edited: `${jobNo}\u0000${fieldKey}`.
  const [openCell, setOpenCell] = useState<string | null>(null);
  const closeCell = useCallback(() => setOpenCell(null), []);
  // The row whose stepper is open for editing, and where its cell is on screen.
  const [stepperFor, setStepperFor] = useState<{ row: JobRow; rect: DOMRect } | null>(null);
  const closeStepper = useCallback(() => setStepperFor(null), []);
  // Right-click menu on a job's name: open it in BC / its SharePoint folder.
  const [menu, setMenu] = useState<{ row: JobRow; x: number; y: number } | null>(null);
  const openMenu = useCallback((row: JobRow, x: number, y: number) => setMenu({ row, x, y }), []);
  // The job whose sketch is being chosen.
  const [pickerFor, setPickerFor] = useState<JobRow | null>(null);
  const canEditSketch = !!editing?.canEditField("sketch");
  const sketchEdit = useMemo(() => ({ canEdit: canEditSketch, openPicker: setPickerFor }), [canEditSketch]);
  // A file dropped anywhere but a Sketch cell would otherwise be opened by the
  // browser in place of the app.
  useEffect(() => {
    if (!canEditSketch) return;
    const stop = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, [canEditSketch]);
  // Live width while dragging; committed to the shared widths on mouse-up.
  const [dragging, setDragging] = useState<{ key: string; w: number } | null>(null);
  const widthOf = (key: string, fallback: number) =>
    dragging?.key === key ? dragging.w : widths[key] ?? autoWidths?.[key] ?? fallback;

  const tree = useMemo(
    () => (groups.length ? buildGroupTree(rows, groups, 0, "", orderOf) : null),
    [rows, groups, orderOf],
  );
  // Right-click on a column header.
  const [headMenu, setHeadMenu] = useState<{ col: JobFieldDef; x: number; y: number } | null>(null);

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

  // Frozen columns: each sticks at the sum of the widths before it.
  const colWidths = cols.map((c) => widthOf(c.key, c.width));
  const nFrozen = effectiveFrozen(colWidths, frozen, visibleWidth);
  const offsets = frozenOffsets(colWidths, nFrozen);
  const frozenKey = cols.slice(0, nFrozen).map((c) => c.key).join("|") + "@" + offsets.join(",");
  // One object per layout, so the memoised rows only redraw when it changes.
  const sticky = useMemo(
    () => Object.fromEntries(cols.slice(0, nFrozen).map((c, i) => [c.key, offsets[i]!])) as Record<string, number>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frozenKey],
  );
  const lastFrozen = cols[nFrozen - 1]?.key ?? "";
  const frozenStyle = (key: string, header = false): React.CSSProperties | undefined =>
    key in sticky ? { position: "sticky", left: sticky[key], zIndex: header ? 12 : 3 } : undefined;
  const frozenClass = (key: string) =>
    key in sticky ? ` jobs-cell--frozen${key === lastFrozen ? " jobs-cell--frozen-last" : ""}` : "";

  return (
    <SketchEditContext.Provider value={sketchEdit}>
    <div className="jobs-grid-frame">
    {cols.length > 1 && (
      <FreezeLine
        widths={colWidths}
        frozen={nFrozen}
        scrollLeft={scrollLeft}
        visibleWidth={visibleWidth}
        onChange={onFrozenChange}
      />
    )}
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
              const sortable = c.type !== "stepper" && c.type !== "sketch";
              return (
                <th
                  key={c.key}
                  className={((sortable ? "jobs-th--sortable" : "") + frozenClass(c.key)).trim() || undefined}
                  style={frozenStyle(c.key, true)}
                  onClick={sortable ? () => onToggleSort(c.key) : undefined}
                  onContextMenu={
                    onEditField && canEditField?.(c)
                      ? (e) => {
                          e.preventDefault();
                          setHeadMenu({ col: c, x: e.clientX, y: e.clientY });
                        }
                      : undefined
                  }
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
                      {def?.type === "badge" && def.multi ? (
                        splitMulti(n.key).map((x) => <JobBadge key={x} field={n.field} value={x} />)
                      ) : def?.type === "badge" ? (
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
                onOpenStepper={editing?.canEditField("stepper") ? setStepperFor : undefined}
                onJobMenu={openMenu}
                sticky={sticky}
                lastFrozen={lastFrozen}
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
      {menu && <JobLinksMenu row={menu.row} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
      {headMenu &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 300 }}
              onClick={() => setHeadMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setHeadMenu(null);
              }}
            />
            <div
              className="job-context-menu"
              style={{ position: "fixed", top: headMenu.y, left: Math.min(headMenu.x, window.innerWidth - 220), zIndex: 301 }}
            >
              <div className="job-context-menu__head">{headMenu.col.label}</div>
              <button
                type="button"
                onClick={() => {
                  onEditField?.(headMenu.col);
                  setHeadMenu(null);
                }}
              >
                Edit field…
              </button>
            </div>
          </>,
          document.body,
        )}
      {pickerFor && <SketchPicker row={pickerFor} onClose={() => setPickerFor(null)} />}
      {stepperFor && (
        <StepperPopover
          jobNo={stepperFor.row.jobNo}
          title={stepperFor.row.job}
          anchor={stepperFor.rect}
          scrollEl={wrapRef.current}
          onClose={closeStepper}
        />
      )}
    </div>
    </div>
    </SketchEditContext.Provider>
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
  onOpenStepper,
  onJobMenu,
  sticky,
  lastFrozen,
}: {
  row: JobRow;
  cols: JobFieldDef[];
  /** Frozen columns → their sticky left offset. */
  sticky: Readonly<Record<string, number>>;
  /** The last frozen column (it carries the freeze shadow). */
  lastFrozen: string;
  onOpen: (row: JobRow) => void;
  /** The custom field key being edited in this row, if any. */
  openKey: string | null;
  onOpenCell: (cell: string) => void;
  onCloseCell: () => void;
  editing?: GridEditing;
  /** Editors: open this row's stepper for editing, under its cell. */
  onOpenStepper?: (open: { row: JobRow; rect: DOMRect }) => void;
  /** Right-click on the job name. */
  onJobMenu?: (row: JobRow, x: number, y: number) => void;
}) {
  const frozenStyle = (key: string): React.CSSProperties | undefined =>
    key in sticky ? { position: "sticky", left: sticky[key], zIndex: 3 } : undefined;
  const frozenClass = (key: string) =>
    key in sticky ? ` jobs-cell--frozen${key === lastFrozen ? " jobs-cell--frozen-last" : ""}` : "";
  return (
    <tr className={`jobs-row${row.tracked ? "" : " jobs-row--untracked"}`} onClick={() => onOpen(row)}>
      {cols.map((c) => {
        // The stepper opens its own editor (StepperPopover).
        if (c.type === "stepper" && onOpenStepper && row.inBc) {
          return (
            <td
              key={c.key}
              style={frozenStyle(c.key)}
              className={`jobs-cell--editable jobs-cell--stepper${frozenClass(c.key)}`}
              title="Click to update the production stage"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStepper({ row, rect: e.currentTarget.getBoundingClientRect() });
              }}
            >
              <Cell row={row} def={c} />
            </td>
          );
        }
        const cf = editing?.canEdit ? editing.editorFor(c) : null;
        const editable = !!cf && cf.type !== "formula-date";
        const isOpen = editable && openKey === c.key;
        const cls = [
          c.key === "job" ? "jobs-cell--primary" : "",
          c.key === "status" ? "jobs-cell--center" : "",
          editable ? "jobs-cell--editable" : "",
          isOpen ? "jobs-cell--editing" : "",
        ].filter(Boolean).join(" ") + frozenClass(c.key);
        return (
          <td
            key={c.key}
            style={frozenStyle(c.key)}
            className={cls.trim() || undefined}
            onContextMenu={
              c.key === "job" && onJobMenu && row.inBc
                ? (e) => {
                    e.preventDefault();
                    onJobMenu(row, e.clientX, e.clientY);
                  }
                : undefined
            }
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
                  styleOf={editing!.styleOf ? (v) => editing!.styleOf!(c, v) : undefined}
                />
              </div>
            ) : (
              <Cell row={row} def={c} canDismissAuto={!!editing?.canEditField("status")} />
            )}
          </td>
        );
      })}
    </tr>
  );
});

function Cell({ row, def, canDismissAuto = false }: { row: JobRow; def: JobFieldDef; canDismissAuto?: boolean }) {
  if (def.type === "stepper") return <StepperCell jobNo={row.inBc ? row.jobNo : undefined} />;
  if (def.type === "sketch") return <SketchCell row={row} />;
  const v = (row as unknown as Record<string, unknown>)[def.key];
  switch (def.type) {
    case "badge":
      return (
        <>
          {/* A multi column (Sales "VB, NH", or one switched to Multi Select) — one pill each. */}
          {def.multi
            ? splitMulti(v).map((x) => <JobBadge key={x} field={def.key} value={x} />)
            : <JobBadge field={def.key} value={String(v ?? "")} />}
          {def.key === "status" && <AutoStatusTag jobNo={row.jobNo} auto={row.statusAuto} canDismiss={canDismissAuto} />}
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
  const { steps, serviceSteps } = useJobSteps(jobNo);
  // A service-only job (no departments) shows its Service stepper.
  const shown = steps.length ? steps : serviceSteps;
  if (!shown.length) return null;
  return <DepartmentStepper steps={shown} size="sm" />;
}

/**
 * The freeze line (like Airtable's): a shadowed line after the frozen columns.
 * Hovering it shows a grab cursor, a blue pill that follows the pointer up and
 * down the line, and "Drag to adjust the number of frozen columns". Dragging
 * snaps to the nearest column edge (freeze-line.ts); letting go saves it on the
 * view for everyone. Without `onChange` (view-only users) it's just the line.
 */
function FreezeLine({
  widths,
  frozen,
  scrollLeft,
  visibleWidth,
  onChange,
}: {
  widths: readonly number[];
  frozen: number;
  scrollLeft: number;
  visibleWidth: number;
  onChange?: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; n: number } | null>(null);
  const x = lineX(widths, frozen);
  const canDrag = !!onChange;
  const frameTop = () => ref.current?.parentElement?.getBoundingClientRect() ?? null;

  const start = (e: React.MouseEvent) => {
    if (!canDrag || e.button !== 0) return;
    e.preventDefault();
    const rect = frameTop();
    if (!rect) return;
    let last = { x, n: frozen };
    const move = (m: MouseEvent) => {
      const mx = Math.max(0, Math.min(m.clientX - rect.left, visibleWidth));
      last = { x: mx, n: nearestFrozen(widths, frozen, scrollLeft, mx, visibleWidth) };
      setDrag(last);
      setHoverY(Math.max(12, Math.min(m.clientY - rect.top, rect.height - 12)));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      setDrag(null);
      setHoverY(null);
      if (last.n !== frozen) onChange!(last.n);
    };
    document.body.style.cursor = "grabbing";
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    setDrag(last);
  };

  // Where a drop would land: the snapped column edge, in visible coordinates.
  const snapX = drag ? (drag.n <= frozen ? lineX(widths, drag.n) : lineX(widths, drag.n) - scrollLeft) : null;
  return (
    <>
      <div
        ref={ref}
        className={`jobs-freeze${scrollLeft > 0 ? " is-scrolled" : ""}${canDrag ? " is-draggable" : ""}${drag ? " is-dragging" : ""}`}
        style={{ left: (drag ? drag.x : x) - 5 }}
        onMouseMove={(e) => {
          if (!canDrag || drag) return;
          const rect = frameTop();
          if (rect) setHoverY(Math.max(12, Math.min(e.clientY - rect.top, rect.height - 12)));
        }}
        onMouseLeave={() => !drag && setHoverY(null)}
        onMouseDown={start}
      >
        <span className="jobs-freeze__line" />
        {canDrag && hoverY !== null && <span className="jobs-freeze__pill" style={{ top: hoverY - 14 }} />}
        {canDrag && hoverY !== null && !drag && (
          <span className="jobs-freeze__tip" style={{ top: hoverY - 13 }}>
            Drag to adjust the number of frozen columns
          </span>
        )}
      </div>
      {snapX !== null && <div className="jobs-freeze__snap" style={{ left: snapX - 1 }} />}
    </>
  );
}

/** Right-click menu on a job's name — the same links as a calendar card's menu. */
function JobLinksMenu({ row, x, y, onClose }: { row: JobRow; x: number; y: number; onClose: () => void }) {
  const go = (url: string) => {
    window.open(url, "_blank", "noopener");
    onClose();
  };
  // Portaled to <body>; stopPropagation keeps a click here from reaching the
  // row (which would open the job) through React's component tree.
  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 300 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="job-context-menu"
        style={{ position: "fixed", top: Math.min(y, window.innerHeight - 120), left: Math.min(x, window.innerWidth - 220), zIndex: 301 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="job-context-menu__head">{row.jobNo}</div>
        <button type="button" onClick={() => go(bcJobUrl(row.jobNo))}>
          Open Project
        </button>
        <button type="button" onClick={() => go(row.sharepointUrl || sharepointJobUrl(row.jobNo))}>
          Open SharePoint Folder
        </button>
      </div>
    </>,
    document.body,
  );
}

/** The job's sketch: a thumbnail that opens the file full size in the sketch
 *  viewer; a larger preview on hover. Editors drop a file on it to upload it to
 *  the job's SharePoint folder as the sketch, or right-click to choose / upload /
 *  go back to the automatic pick / remove it from the list (never deleting the
 *  SharePoint file). Blank when the job has no sketch. */
function SketchCell({ row }: { row: JobRow }) {
  const jobNo = row.jobNo;
  const sketch = useSketchStore((s) => s.byJob.get(jobNo));
  const thumb = useSketchStore((s) => s.thumbs.get(jobNo));
  const wantThumb = useSketchStore((s) => s.wantThumb);
  const uploadFile = useSketchStore((s) => s.uploadFile);
  const unpin = useSketchStore((s) => s.unpin);
  const removeSketch = useSketchStore((s) => s.remove);
  const { canEdit, openPicker } = useContext(SketchEditContext);
  const [viewing, setViewing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ busy: boolean; text: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (sketch) wantThumb(jobNo);
  }, [sketch, jobNo, wantThumb]);

  const editable = canEdit && !!row.sharepointUrl;
  const upload = async (file: File) => {
    setStatus({ busy: true, text: `Uploading ${file.name}…` });
    try {
      await uploadFile(jobNo, row.sharepointUrl, file);
      setStatus(null);
    } catch (e) {
      setStatus({ busy: false, text: `Upload failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const isPdf = sketch ? /\.pdf$/i.test(sketch.fileName) : false;

  return (
    <div
      className={`jobs-sketch-cell${dragOver ? " jobs-sketch-cell--drop" : ""}${editable && !sketch ? " jobs-sketch-cell--empty" : ""}`}
      title={editable ? (sketch ? undefined : "Drop a file here, or right-click, to add the sketch") : undefined}
      onClick={(e) => editable && !sketch && (e.stopPropagation(), openPicker(row))}
      onContextMenu={
        editable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY });
            }
          : undefined
      }
      onDragOver={
        editable
          ? (e) => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={() => setDragOver(false)}
      onDrop={
        editable
          ? (e) => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void upload(file);
            }
          : undefined
      }
    >
      {status ? (
        <span className={`jobs-sketch__status${status.busy ? "" : " jobs-sketch__status--error"}`} title={status.text}>
          {status.busy ? "Uploading…" : "Failed"}
        </span>
      ) : sketch ? (
        <button
          type="button"
          className="jobs-sketch"
          title={`${sketch.fileName}${sketch.pinned ? " (chosen)" : ""} — click to view`}
          onClick={(e) => {
            e.stopPropagation();
            setHover(null);
            setViewing(true);
          }}
          onMouseEnter={(e) => thumb && setHover(e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
        >
          {thumb ? <img src={thumb} alt={sketch.fileName} /> : <span className="jobs-sketch__file">{isPdf ? "PDF" : "FILE"}</span>}
        </button>
      ) : editable ? (
        <span className="jobs-sketch__add">+</span>
      ) : null}
      {hover &&
        thumb &&
        sketch &&
        createPortal(
          <div
            className="jobs-sketch-preview"
            style={{
              top: Math.max(8, Math.min(hover.top - 60, window.innerHeight - 268)),
              left: hover.right + 8 + 330 > window.innerWidth ? hover.left - 338 : hover.right + 8,
            }}
          >
            <img src={thumb} alt="" />
            <div className="jobs-sketch-preview__name">{sketch.fileName}</div>
          </div>,
          document.body,
        )}
      {menu &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 300 }}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu(null);
              }}
            />
            <div
              className="job-context-menu"
              style={{ position: "fixed", top: Math.min(menu.y, window.innerHeight - 190), left: Math.min(menu.x, window.innerWidth - 230), zIndex: 301 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="job-context-menu__head">Sketch · {jobNo}</div>
              {sketch && (
                <button type="button" onClick={() => (setMenu(null), setViewing(true))}>
                  View
                </button>
              )}
              {sketch && (
                <button type="button" onClick={() => (window.open(sketch.fileUrl, "_blank", "noopener"), setMenu(null))}>
                  Open in SharePoint
                </button>
              )}
              <button type="button" onClick={() => (setMenu(null), openPicker(row))}>
                Choose a different file…
              </button>
              <label className="job-context-menu__file">
                Upload a file…
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setMenu(null);
                    if (f) void upload(f);
                  }}
                />
              </label>
              {sketch?.pinned && (
                <button type="button" onClick={() => (setMenu(null), void unpin(jobNo))}>
                  Use the automatic pick
                </button>
              )}
              {sketch && (
                <button type="button" className="job-context-menu__danger" onClick={() => (setMenu(null), setConfirmRemove(true))}>
                  Remove File
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
      {viewing && sketch && (
        <SketchViewer
          jobNo={jobNo}
          sketch={sketch}
          canRemove={editable}
          onRemove={() => setConfirmRemove(true)}
          onClose={() => setViewing(false)}
        />
      )}
      {confirmRemove && sketch && (
        <RemoveSketchConfirm
          jobNo={jobNo}
          fileName={sketch.fileName}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            setViewing(false);
            void removeSketch(jobNo);
          }}
        />
      )}
    </div>
  );
}
