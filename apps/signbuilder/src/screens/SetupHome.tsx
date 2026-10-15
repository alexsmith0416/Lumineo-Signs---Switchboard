import { useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import type { SetupData } from "../domain/types";
import { parseBcSetupExport, type ImportSummary } from "../setup/import-bc";
import { useSetupStore } from "../store/setup-store";

/** Setup hub. Step 1: the one-time import from Business Central. The setup
 *  tools (Decision Tree, Show Path, Rule Matrix, Blocks, Versions…) follow. */
export default function SetupHome() {
  const setup = useSetupStore((s) => s.setup);
  const importSetup = useSetupStore((s) => s.importSetup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ setup: SetupData; summary: ImportSummary; fileName: string } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    setError("");
    setDone("");
    if (!file) return;
    try {
      const result = parseBcSetupExport(await file.text());
      setParsed({ ...result, fileName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const runImport = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      await importSetup(parsed.setup);
      const s = parsed.summary;
      setDone(`Imported ${s.categories} categories, ${s.signTypes} sign types, ${s.blocks} blocks, ${s.questions} questions, ${s.rules} rules, ${s.templates} template lines and ${s.references} reference pages.`);
      setParsed(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const types = setup?.signTypes.filter((t) => !t.isBlock) ?? [];
  return (
    <div className="sbp-page">
      <div className="sbp-card">
        <div className="sbp-caption">Current setup</div>
        <div className="sbp-kpis">
          <div className="sbp-kpi">
            <div className="sbp-caption">Categories</div>
            <div className="sbp-kpi__value">{setup?.categories.length ?? 0}</div>
          </div>
          <div className="sbp-kpi">
            <div className="sbp-caption">Sign Types</div>
            <div className="sbp-kpi__value">{types.length}</div>
          </div>
          <div className="sbp-kpi">
            <div className="sbp-caption">Questions</div>
            <div className="sbp-kpi__value">{setup?.questions.length ?? 0}</div>
          </div>
          <div className="sbp-kpi">
            <div className="sbp-caption">Spec Rules</div>
            <div className="sbp-kpi__value">{setup?.rules.length ?? 0}</div>
          </div>
          <div className="sbp-kpi">
            <div className="sbp-caption">Reference Pages</div>
            <div className="sbp-kpi__value">{setup?.references.length ?? 0}</div>
          </div>
        </div>
        <table className="sbp-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Sign types</th>
            </tr>
          </thead>
          <tbody>
            {setup?.categories
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((c) => (
                <tr key={c.code}>
                  <td style={{ fontWeight: 700 }}>
                    {c.description} <span className="sbp-code">{c.codePrefix}</span>
                  </td>
                  <td>
                    {types
                      .filter((t) => t.categoryCode === c.code)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((t) => t.description)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="sbp-card">
        <div className="sbp-caption">Import from Business Central (one-time move)</div>
        <p style={{ fontSize: 13 }}>
          In Business Central open <b>Sign Builder Setup → Export Setup (JSON)</b>, then pick the downloaded file here. It brings over every category, sign type, question
          block, question, answer, Spec Rule, Field Description template, spec reference page (with images), vinyl color and the stage checklist. It <b>replaces</b> the
          setup in the app — use it before go-live; after that the app is where the setup is edited.
        </p>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={(e) => void onFile(e.target.files?.[0])} />
        {error && <div className="sbp-banner sbp-banner--error" style={{ marginTop: 10 }}>{error}</div>}
        {done && <div className="sbp-banner sbp-banner--ok" style={{ marginTop: 10 }}>{done}</div>}
      </div>

      <div className="sbp-card">
        <div className="sbp-caption">Setup tools</div>
        <p className="sbp-muted" style={{ fontSize: 13 }}>
          Categories, Sign Types, Decision Tree, Show Path, Spec Rule Matrix, Question Blocks, Copy/Paste, Undo & Versions, Test Category, Check Setup, Stage Checklist and
          Spec References — coming in the next build.
        </p>
      </div>

      {parsed && (
        <ConfirmDialog
          title="Replace the setup?"
          message={`${parsed.fileName}: ${parsed.summary.categories} categories, ${parsed.summary.signTypes} sign types, ${parsed.summary.blocks} blocks, ${parsed.summary.questions} questions, ${parsed.summary.rules} rules, ${parsed.summary.templates} template lines, ${parsed.summary.references} reference pages${parsed.summary.convertedOldRules ? ` (${parsed.summary.convertedOldRules} old show/hide rules converted)` : ""}. The current setup in the app is replaced.`}
          confirmLabel={busy ? "Importing…" : "Import"}
          busy={busy}
          danger
          onCancel={() => setParsed(null)}
          onConfirm={() => void runImport()}
        />
      )}
    </div>
  );
}
