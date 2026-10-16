import { useMemo, useState } from "react";
import type { SignLine, Spec } from "../../domain/types";
import { buildFromTemplates, buildProduction, isHeadingLine } from "../../engine/descriptions";
import { Modal } from "../../components/ui";
import { useSetupStore } from "../../store/setup-store";

type Tab = "production" | "field";

/** Production and Field Descriptions as they'll be written to the BC job. */
export default function DescriptionPreview({ spec, lines, onClose }: { spec: Spec; lines: SignLine[]; onClose: () => void }) {
  const idx = useSetupStore((s) => s.idx);
  const [tab, setTab] = useState<Tab>("production");
  // Part #s after linked materials: Setup's default, switchable here.
  const [partNumbers, setPartNumbers] = useState(() => !!idx?.data.settings.showPartNumbers);
  const text = useMemo(() => {
    if (!idx) return { production: "", field: "" };
    const opts = { partNumbers };
    return { production: buildProduction(idx, spec, lines, opts), field: buildFromTemplates(idx, spec, lines, "field", opts) };
  }, [idx, spec, lines, partNumbers]);
  const current = text[tab];
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      title={`Descriptions – ${spec.number}`}
      onClose={onClose}
      wide
      actions={
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(current).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy text"}
        </button>
      }
    >
      <div className="sbp-tabs">
        <button type="button" className={`sbp-tab${tab === "production" ? " sbp-tab--on" : ""}`} onClick={() => setTab("production")}>
          Production Description
        </button>
        <button type="button" className={`sbp-tab${tab === "field" ? " sbp-tab--on" : ""}`} onClick={() => setTab("field")}>
          Field Description
        </button>
        <div className="sbp-spacer" />
        <label className="sbp-check" data-tour="part-numbers" title="Print the BC part # after each linked material">
          <input type="checkbox" checked={partNumbers} onChange={(e) => setPartNumbers(e.target.checked)} /> Part #s
        </label>
      </div>
      <DescriptionText text={current} />
      <div className="sbp-muted" style={{ fontSize: 12, marginTop: 8 }}>
        To write these to the BC project, use Generate to Project on the spec (it shows them next to what BC has now).
      </div>
    </Modal>
  );
}

export function DescriptionText({ text }: { text: string }) {
  if (!text) return <div className="sbp-desc sbp-muted">(nothing generated yet)</div>;
  return (
    <div className="sbp-desc">
      {text.split("\n").map((line, i) => (
        <div key={i} className={isHeadingLine(line) ? "sbp-desc__heading" : undefined}>
          {line || " "}
        </div>
      ))}
    </div>
  );
}
