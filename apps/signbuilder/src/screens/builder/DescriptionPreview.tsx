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
  const text = useMemo(() => {
    if (!idx) return { production: "", field: "" };
    return { production: buildProduction(idx, spec, lines), field: buildFromTemplates(idx, spec, lines, "field") };
  }, [idx, spec, lines]);
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
      </div>
      <DescriptionText text={current} />
      <div className="sbp-muted" style={{ fontSize: 12, marginTop: 8 }}>
        Generate to Project (writes these to the BC job, after a side-by-side review) comes with the Business Central link.
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
