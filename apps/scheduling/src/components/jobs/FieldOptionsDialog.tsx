import { useState } from "react";
import { OptionsEditor } from "./CustomFieldDialogs";
import { builtinOptions, defaultBg } from "./field-options";
import { useFieldOptionsStore } from "../../store/field-options-store";

/**
 * "Edit field" for a built-in choice column (Current Status, Priority, Hold,
 * Vendor, …): drag the options into the order you want — the dropdown shows
 * them in that order and the column sorts and groups by it — add new ones,
 * rename or remove them, and pick colours. Saved for everyone.
 * `seed` = values in use, for columns with no fixed list (Sales, Region…).
 */
export default function FieldOptionsDialog({
  field,
  label,
  seed,
  onClose,
}: {
  field: string;
  label: string;
  seed: string[];
  onClose: () => void;
}) {
  const override = useFieldOptionsStore((s) => s.overrides[field]);
  const save = useFieldOptionsStore((s) => s.save);
  const [draft, setDraft] = useState<{ opts?: string[]; optColors?: Record<string, string> }>(() => {
    const opts = builtinOptions(field, override);
    const list = opts.length ? opts : seed;
    return {
      opts: list,
      // Every option's current colour, so the swatches show what the badges look like.
      optColors: Object.fromEntries(list.map((o) => [o, override?.colors?.[o] ?? defaultBg(field, o)])),
    };
  });

  const done = () => {
    const opts = [...new Set((draft.opts ?? []).map((o) => o.trim()).filter(Boolean))];
    // Only keep colours that differ from the defaults.
    const colors = Object.fromEntries(
      Object.entries(draft.optColors ?? {}).filter(([o, c]) => opts.includes(o) && c !== defaultBg(field, o)),
    );
    save(field, { opts, colors });
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel cf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Edit field · {label}</div>
        <div className="slide-over__body cf-dialog__body">
          <p className="billing-periods-panel__note">
            Drag <strong>⠿</strong> to reorder — the dropdown lists the options in this order, and sorting or grouping by{" "}
            {label} follows it. Add new options at the bottom. Renaming or removing an option doesn't change jobs that
            already use it. Saved for everyone.
          </p>
          <OptionsEditor def={draft} colors onChange={(p) => setDraft({ ...draft, ...p })} colorOf={(o) => draft.optColors?.[o] ?? defaultBg(field, o)} />
        </div>
        <div className="users-admin__footer" style={{ gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={done}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
