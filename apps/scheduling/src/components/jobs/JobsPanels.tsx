// Filter / Sort / Group / Fields dropdown panels for the Jobs view — ported from
// the Airtable recreation app (FilterPanel / SortPanel / GroupPanel / ColumnPanel).
import { useState } from "react";
import type { JobRow } from "../../services/job-tracking";
import { type JobFieldDef } from "./jobs-fields";
import { JobBadge, OptionBadges } from "./JobsGrid";
import { FIELD_TYPES } from "../../services/custom-fields";
import type { FilterCondition, FilterOp, GroupCriterion, SortCriterion } from "./jobs-grid-state";

const OPS: { value: FilterOp; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
  { value: "is_any_of", label: "is any of" },
  { value: "is_none_of", label: "is none of" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const newId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function PanelShell({ title, onClose, children, footer, extra }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="jobs-panel" onClick={(e) => e.stopPropagation()}>
      <div className="jobs-panel__head">
        <span>{title}</span>
        <span className="jobs-panel__head-actions">
          {extra}
          <button type="button" className="jobs-panel__x" onClick={onClose} aria-label="Close">✕</button>
        </span>
      </div>
      {children}
      <div className="jobs-panel__foot">{footer}</div>
    </div>
  );
}

export function FilterPanel({ fields, filters, rows, onChange, onClose }: {
  fields: JobFieldDef[];
  filters: FilterCondition[];
  /** Used to offer each badge field's actual values in "is any of". */
  rows: JobRow[];
  onChange: (f: FilterCondition[]) => void;
  onClose: () => void;
}) {
  const update = (id: string, patch: Partial<FilterCondition>) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const byKey = new Map(fields.map((d) => [d.key as string, d]));
  // Pick-list values: a custom select's options, else the values in the rows.
  const valuesOf = (field: string) => {
    const opts = byKey.get(field)?.custom?.opts;
    if (opts?.length) return opts;
    return [...new Set(rows.map((r) => String((r as unknown as Record<string, unknown>)[field] ?? "")).filter(Boolean))].sort();
  };

  return (
    <PanelShell
      title="In this view, show jobs"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="jobs-panel__add"
            onClick={() => onChange([...filters, { id: newId(), conjunction: "and", field: "status", op: "is_any_of", value: "" }])}>
            + Add condition
          </button>
          {filters.length > 0 && <button type="button" className="jobs-panel__clear" onClick={() => onChange([])}>Clear all</button>}
        </>
      }
    >
      {filters.length === 0 && <div className="jobs-panel__empty">No filters. Add a condition below.</div>}
      {filters.map((f, i) => {
        const def = byKey.get(f.field);
        const picker = (f.op === "is_any_of" || f.op === "is_none_of") && (def?.type === "badge" || def?.type === "select");
        const chosen = new Set(f.value.split(",").map((v) => v.trim()).filter(Boolean));
        return (
          <div key={f.id} className="jobs-panel__cond">
            <div className="jobs-panel__row">
              {i === 0 ? (
                <span className="jobs-panel__where">Where</span>
              ) : (
                <select value={f.conjunction} onChange={(e) => update(f.id, { conjunction: e.target.value as "and" | "or" })}>
                  <option value="and">and</option>
                  <option value="or">or</option>
                </select>
              )}
              <select value={f.field} onChange={(e) => update(f.id, { field: e.target.value, value: "" })}>
                {fields.filter((d) => d.type !== "stepper").map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              <select value={f.op} onChange={(e) => update(f.id, { op: e.target.value as FilterOp, value: "" })}>
                {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {f.op !== "is_empty" && f.op !== "is_not_empty" && !picker && (
                <input value={f.value} placeholder="Value…" onChange={(e) => update(f.id, { value: e.target.value })} />
              )}
              <button type="button" className="jobs-panel__x" onClick={() => onChange(filters.filter((x) => x.id !== f.id))} aria-label="Remove condition">✕</button>
            </div>
            {picker && (
              <div className="jobs-panel__picker">
                {valuesOf(f.field).map((v) => (
                  <button key={v} type="button"
                    className={`jobs-panel__pick${chosen.has(v) ? " jobs-panel__pick--on" : ""}`}
                    onClick={() => {
                      const next = new Set(chosen);
                      if (next.has(v)) next.delete(v);
                      else next.add(v);
                      update(f.id, { value: [...next].join(",") });
                    }}>
                    {def?.custom ? <OptionBadges def={def.custom} value={v} /> : <JobBadge field={f.field} value={v} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </PanelShell>
  );
}

export function SortPanel({ fields, sorts, onChange, onClose }: {
  fields: JobFieldDef[];
  sorts: SortCriterion[];
  onChange: (s: SortCriterion[]) => void;
  onClose: () => void;
}) {
  const sortable = fields.filter((d) => d.type !== "stepper");
  const used = new Set(sorts.map((s) => s.field));
  return (
    <PanelShell
      title="Sort by"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="jobs-panel__add" disabled={sortable.every((d) => used.has(d.key))}
            onClick={() => onChange([...sorts, { field: sortable.find((d) => !used.has(d.key))!.key, asc: true }])}>
            + Add sort
          </button>
          {sorts.length > 0 && <button type="button" className="jobs-panel__clear" onClick={() => onChange([])}>Clear all</button>}
        </>
      }
    >
      {sorts.length === 0 && <div className="jobs-panel__empty">Sorted by Current Status. Add a sort to change it.</div>}
      {sorts.map((s, i) => (
        <div key={i} className="jobs-panel__row">
          <select value={s.field} onChange={(e) => onChange(sorts.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
            {sortable.map((d) => <option key={d.key} value={d.key} disabled={used.has(d.key) && d.key !== s.field}>{d.label}</option>)}
          </select>
          <select value={s.asc ? "asc" : "desc"} onChange={(e) => onChange(sorts.map((x, j) => (j === i ? { ...x, asc: e.target.value === "asc" } : x)))}>
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
          <button type="button" className="jobs-panel__x" onClick={() => onChange(sorts.filter((_, j) => j !== i))} aria-label="Remove sort">✕</button>
        </div>
      ))}
    </PanelShell>
  );
}

export function GroupPanel({ fields, groups, onChange, onClose, onCollapseAll, onExpandAll }: {
  fields: JobFieldDef[];
  groups: GroupCriterion[];
  onChange: (g: GroupCriterion[]) => void;
  onClose: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}) {
  const groupable = fields.filter((d) => d.type !== "stepper" && d.type !== "multiline");
  const used = new Set(groups.map((g) => g.field));
  return (
    <PanelShell
      title="Group by"
      onClose={onClose}
      extra={groups.length > 0 && (
        <>
          <button type="button" className="jobs-panel__mini" onClick={onCollapseAll}>Collapse all</button>
          <button type="button" className="jobs-panel__mini" onClick={onExpandAll}>Expand all</button>
        </>
      )}
      footer={
        <>
          <button type="button" className="jobs-panel__add" disabled={groupable.every((d) => used.has(d.key))}
            onClick={() => onChange([...groups, { field: groupable.find((d) => !used.has(d.key))!.key, asc: true }])}>
            + Add subgroup
          </button>
          {groups.length > 0 && <button type="button" className="jobs-panel__clear" onClick={() => onChange([])}>Clear all</button>}
        </>
      }
    >
      {groups.length === 0 && <div className="jobs-panel__empty">No grouping.</div>}
      {groups.map((g, i) => (
        <div key={i} className="jobs-panel__row">
          <select value={g.field} onChange={(e) => onChange(groups.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
            {groupable.map((d) => <option key={d.key} value={d.key} disabled={used.has(d.key) && d.key !== g.field}>{d.label}</option>)}
          </select>
          <select value={g.asc ? "asc" : "desc"} onChange={(e) => onChange(groups.map((x, j) => (j === i ? { ...x, asc: e.target.value === "asc" } : x)))}>
            <option value="asc">First → Last</option>
            <option value="desc">Last → First</option>
          </select>
          <button type="button" className="jobs-panel__x" onClick={() => onChange(groups.filter((_, j) => j !== i))} aria-label="Remove group">✕</button>
        </div>
      ))}
    </PanelShell>
  );
}

export function FieldsPanel({ fields, cols, onChange, onClose, onAddField, onEditField }: {
  fields: JobFieldDef[];
  cols: string[];
  onChange: (cols: string[]) => void;
  onClose: () => void;
  /** Editors: open "Add fields". */
  onAddField?: () => void;
  /** Editors: "Edit field…" — any field's name; options / type where it has them. */
  onEditField?: (key: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const byKey = new Map(fields.map((f) => [f.key as string, f]));
  const shown = cols.filter((k) => byKey.has(k));
  const hidden = fields.map((f) => f.key as string).filter((k) => !cols.includes(k));
  const q = search.trim().toLowerCase();
  const match = (k: string) => !q || (byKey.get(k)?.label ?? k).toLowerCase().includes(q);

  const toggle = (k: string) => {
    if (k === "job") return;
    onChange(cols.includes(k) ? cols.filter((c) => c !== k) : [...cols, k]);
  };
  const dropOn = (target: string) => {
    if (!dragKey || dragKey === target || target === "job") return;
    const next = cols.filter((c) => c !== dragKey);
    next.splice(next.indexOf(target), 0, dragKey);
    onChange(next);
  };

  const row = (k: string, visible: boolean) => (
    <label
      key={k}
      className={`jobs-fields__row${dragKey === k ? " jobs-fields__row--dragging" : ""}`}
      draggable={visible && k !== "job" && !q}
      onDragStart={() => setDragKey(k)}
      onDragEnd={() => setDragKey(null)}
      onDragOver={(e) => visible && dragKey && e.preventDefault()}
      onDrop={() => dropOn(k)}
    >
      <span className="jobs-fields__grip" aria-hidden="true">{visible && k !== "job" ? "⠿" : ""}</span>
      <input type="checkbox" checked={visible} disabled={k === "job"} onChange={() => toggle(k)} />
      <span className="jobs-fields__name">{byKey.get(k)?.label ?? k}</span>
      {byKey.get(k)?.custom && (
        <span className="jobs-fields__custom" title={FIELD_TYPES.find((f) => f.type === byKey.get(k)!.custom!.type)?.label}>
          {FIELD_TYPES.find((f) => f.type === byKey.get(k)!.custom!.type)?.icon}
        </span>
      )}
      {onEditField && (
        <button
          type="button"
          className="jobs-fields__edit"
          title="Edit field"
          onClick={(e) => {
            e.preventDefault();
            onEditField(k);
          }}
        >
          ✎
        </button>
      )}
    </label>
  );

  return (
    <PanelShell
      title="Fields in this view"
      onClose={onClose}
      extra={
        <>
          <button type="button" className="jobs-panel__mini" onClick={() => onChange([...cols, ...hidden])}>Show all</button>
          <button type="button" className="jobs-panel__mini" onClick={() => onChange(["job"])}>Hide all</button>
        </>
      }
      footer={
        <>
          {onAddField && (
            <button type="button" className="jobs-panel__add" onClick={onAddField}>
              + Add field
            </button>
          )}
          <span className="jobs-panel__empty" style={{ padding: 0 }}>Drag ⠿ to reorder the shown fields.</span>
        </>
      }
    >
      <div className="jobs-panel__row">
        <input value={search} placeholder="Find a field…" onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="jobs-fields">
        {shown.filter(match).map((k) => row(k, true))}
        {hidden.filter(match).length > 0 && <div className="jobs-fields__divider">Hidden</div>}
        {hidden.filter(match).map((k) => row(k, false))}
      </div>
    </PanelShell>
  );
}
