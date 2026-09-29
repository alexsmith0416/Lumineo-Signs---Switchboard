import { memo, useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import type { JobRow } from "../../services/job-tracking";
import DepartmentStepper from "../DepartmentStepper";
import { useJobSteps } from "../../hooks/useJobSteps";
import { BADGE_COLORS, JOB_FIELDS, badgeColor, type JobFieldDef } from "./jobs-fields";
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

/** Read-only virtualised Jobs grid (Phase 1). Ported in spirit from the
 *  Airtable recreation app's Grid.tsx — same grouping / sorting / resizing. */
export default function JobsGrid({
  rows,
  cols,
  groups,
  sorts,
  onToggleSort,
  onOpen,
  collapseSignal,
}: {
  rows: JobRow[];
  cols: JobFieldDef[];
  groups: GroupCriterion[];
  sorts: SortCriterion[];
  onToggleSort: (field: string) => void;
  /** Open a job's panel (row click). */
  onOpen: (row: JobRow) => void;
  /** Bump .n to collapse (all=true) or expand (all=false) every group. */
  collapseSignal: { n: number; all: boolean };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [widths, setWidths] = useState<Record<string, number>>({});

  const tree = useMemo(() => (groups.length ? buildGroupTree(rows, groups) : null), [rows, groups]);

  // Collapse / expand every group when the toolbar asks (the signal's .n bumps).
  const treeRef = useRef(tree);
  treeRef.current = tree;
  useEffect(() => {
    if (collapseSignal.n === 0) return;
    const t = treeRef.current;
    setCollapsed(collapseSignal.all && t ? new Set(allGroupPaths(t)) : new Set());
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
    startTransition(() =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      }),
    );
  }, []);

  const startResize = (e: React.MouseEvent, key: string, start: number) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const move = (m: MouseEvent) => setWidths((w) => ({ ...w, [key]: Math.max(50, start + m.clientX - x0) }));
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
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
      <table className="jobs-grid">
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={{ width: widths[c.key] ?? c.width }} />
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
                    onMouseDown={(e) => startResize(e, c.key, widths[c.key] ?? c.width)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setWidths((w) => {
                        const n = { ...w };
                        delete n[c.key];
                        return n;
                      });
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
              const def = JOB_FIELDS[n.field];
              return (
                <tr key={`g:${n.path}`} className={`jobs-group jobs-group--d${n.depth}`} onClick={() => toggle(n.path)}>
                  <td colSpan={cols.length}>
                    <div className="jobs-group__inner" style={{ paddingLeft: 8 + n.depth * 20 }}>
                      <span className={`jobs-group__chev${isCollapsed ? " jobs-group__chev--closed" : ""}`}>▾</span>
                      <span className="jobs-group__field">{def?.label ?? n.field}</span>
                      {def?.type === "badge" ? <JobBadge field={n.field} value={n.key} /> : <span className="jobs-group__value">{n.key}</span>}
                      <span className="jobs-group__count">{n.count}</span>
                    </div>
                  </td>
                </tr>
              );
            }
            return <JobGridRow key={item.row.id} row={item.row} cols={cols} onOpen={onOpen} />;
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

const JobGridRow = memo(function JobGridRow({ row, cols, onOpen }: { row: JobRow; cols: JobFieldDef[]; onOpen: (row: JobRow) => void }) {
  return (
    <tr className={`jobs-row${row.tracked ? "" : " jobs-row--untracked"}`} onClick={() => onOpen(row)}>
      {cols.map((c) => (
        <td key={c.key} className={c.key === "job" ? "jobs-cell--primary" : undefined}>
          <Cell row={row} def={c} />
        </td>
      ))}
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
