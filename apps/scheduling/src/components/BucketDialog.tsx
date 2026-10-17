import { useMemo, useState } from "react";
import type { Employee } from "../engine/types";
import type { JobRow } from "../services/job-tracking";
import { ALL_STEP_DEFS } from "../services/production-steps";
import { EMPTY_FILTER, matchesFilter, type BucketFilter, type BucketList } from "../services/buckets";

type Vals = Omit<BucketList, "id" | "kind" | "sortOrder" | "collapsed">;

/**
 * New / edit Bucket List: name + colours, the department whose completion drops
 * a job off, manual or filter (built from the Jobs list fields, with a live
 * count of the jobs it matches), and the people whose free time it fills.
 */
export default function BucketDialog({
  initial,
  rows,
  employees,
  defaultDeptKey,
  onSave,
  onCancel,
}: {
  initial?: BucketList;
  rows: readonly JobRow[];
  employees: readonly Employee[];
  defaultDeptKey: string;
  onSave: (vals: Vals) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#141464");
  const [textColor, setTextColor] = useState(initial?.textColor ?? "#ffffff");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deptKey, setDeptKey] = useState(initial?.deptKey ?? defaultDeptKey);
  const [mode, setMode] = useState<BucketList["mode"]>(initial?.mode ?? "manual");
  const [filter, setFilter] = useState<BucketFilter>(initial?.filter ?? EMPTY_FILTER);
  const [people, setPeople] = useState<string[]>(initial?.defaultEmployees ?? []);
  const setF = <K extends keyof BucketFilter>(k: K, v: BucketFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));

  const options = useMemo(() => {
    const uniq = (vals: string[]) => [...new Set(vals.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return { statuses: uniq(rows.map((r) => r.status)), priorities: uniq(rows.map((r) => r.priority)) };
  }, [rows]);
  const matches = useMemo(
    () => (mode === "filter" ? rows.filter((r) => r.inBc && matchesFilter(r, filter)) : []),
    [mode, rows, filter],
  );
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="slide-over" onClick={onCancel}>
      <div className="slide-over__panel bucket-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">{initial ? "Edit bucket list" : "New bucket list"}</div>
        <div className="slide-over__body bucket-dialog__body">
          <label className="form-field">
            <span className="form-field__label">Name</span>
            <input className="form-field__input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Aaron — vinyl to cut" />
          </label>
          <div className="bucket-dialog__row">
            <label className="bucket-dialog__color">
              Card <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
            <label className="bucket-dialog__color">
              Text <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </label>
            <span className="bucket-dialog__swatch" style={{ background: color, color: textColor }}>
              {name || "Bucket"}
            </span>
          </div>
          <label className="form-field">
            <span className="form-field__label">Description (optional)</span>
            <input className="form-field__input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">A job drops off when this step is completed</span>
            <select className="form-field__select" value={deptKey} onChange={(e) => setDeptKey(e.target.value)}>
              <option value="">— never (remove jobs by hand) —</option>
              {ALL_STEP_DEFS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <div className="form-field">
            <span className="form-field__label">Jobs on this list</span>
            <div className="region-toggle" role="group">
              {(
                [
                  ["manual", "Added by hand"],
                  ["filter", "From a filter"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={"region-toggle__btn" + (mode === m ? " region-toggle__btn--active" : "")}
                  onClick={() => setMode(m)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "filter" && (
            <div className="bucket-dialog__filter">
              <p className="billing-periods-panel__note">
                Jobs from the Jobs list that match <strong>all</strong> of these join automatically, and leave when they
                stop matching. Leave a field blank for "any". You can still add jobs by hand.
              </p>
              <ChipPick label="Current Status" options={options.statuses} value={filter.statuses} onToggle={(v) => setF("statuses", toggle(filter.statuses, v))} />
              <ChipPick label="Priority" options={options.priorities} value={filter.priorities} onToggle={(v) => setF("priorities", toggle(filter.priorities, v))} />
              <div className="bucket-dialog__row">
                <label className="form-field">
                  <span className="form-field__label">Mfg Region</span>
                  <select className="form-field__select" value={filter.mfgRegion} onChange={(e) => setF("mfgRegion", e.target.value)}>
                    <option value="">Any</option>
                    <option value="WK">WK</option>
                    <option value="NEK">NEK</option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-field__label">Install Region</span>
                  <select className="form-field__select" value={filter.installRegion} onChange={(e) => setF("installRegion", e.target.value)}>
                    <option value="">Any</option>
                    <option value="WK">WK</option>
                    <option value="NEK">NEK</option>
                  </select>
                </label>
              </div>
              <div className="bucket-dialog__row">
                <label className="form-field">
                  <span className="form-field__label">Customer / job contains</span>
                  <input className="form-field__input" value={filter.customer} onChange={(e) => setF("customer", e.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Salesperson</span>
                  <input className="form-field__input" value={filter.salesperson} onChange={(e) => setF("salesperson", e.target.value)} placeholder="code or name" />
                </label>
              </div>
              <div className="bucket-dialog__row">
                <label className="form-field">
                  <span className="form-field__label">Released from</span>
                  <input className="form-field__input" type="date" value={filter.releasedFrom} onChange={(e) => setF("releasedFrom", e.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-field__label">Released to</span>
                  <input className="form-field__input" type="date" value={filter.releasedTo} onChange={(e) => setF("releasedTo", e.target.value)} />
                </label>
              </div>
              <div className="bucket-dialog__preview">
                <strong>{matches.length}</strong> job{matches.length === 1 ? "" : "s"} match now
                {matches.length > 0 && (
                  <span>
                    {" "}— {matches.slice(0, 5).map((r) => `${r.jobNo} ${r.name}`).join(" · ")}
                    {matches.length > 5 ? " …" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="form-field">
            <span className="form-field__label">Fills the free time of (every day)</span>
            <div className="bucket-dialog__people">
              {employees.map((e) => (
                <label key={e.id}>
                  <input type="checkbox" checked={people.includes(e.id)} onChange={() => setPeople((p) => toggle(p, e.id))} /> {e.name}
                </label>
              ))}
            </div>
            <span className="billing-periods-panel__note">
              Their open hours each day show this bucket as a card — after that day&rsquo;s scheduled jobs.
            </span>
          </div>
        </div>
        <div className="slide-over__footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                color,
                textColor,
                description: description.trim(),
                deptKey,
                mode,
                filter: mode === "filter" ? filter : null,
                defaultEmployees: people,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ChipPick({ label, options, value, onToggle }: { label: string; options: string[]; value: string[]; onToggle: (v: string) => void }) {
  if (!options.length) return null;
  return (
    <div className="form-field">
      <span className="form-field__label">{label}</span>
      <div className="bucket-dialog__chips">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={"bucket-chip" + (value.includes(o) ? " bucket-chip--on" : "")}
            aria-pressed={value.includes(o)}
            onClick={() => onToggle(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
