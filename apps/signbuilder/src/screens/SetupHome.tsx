import { useMemo, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import type { SetupData } from "../domain/types";
import { checkSetup } from "../setup/check-setup";
import { parseBcSetupExport, type ImportSummary } from "../setup/import-bc";
import { useDemoStore } from "../store/demo-store";
import { useSetupStore } from "../store/setup-store";
import Categories from "./setup/Categories";
import CheckSetup from "./setup/CheckSetup";
import DecisionTree from "./setup/DecisionTree";
import Descriptions from "./setup/Descriptions";
import MaterialsItems from "./setup/MaterialsItems";
import RuleMatrix from "./setup/RuleMatrix";
import SignTypes from "./setup/SignTypes";

type SetupTab = "overview" | "categories" | "types" | "questions" | "rules" | "descriptions" | "materials" | "check";

/** Setup hub: Overview (+ the one-time import from Business Central),
 *  Categories, Sign Types, Questions (decision tree), Rules (matrix),
 *  Descriptions (Field / Extended templates), Materials & Items and Check
 *  Setup. Undo steps back through this session's changes. */
export default function SetupHome() {
  const [tab, setTab] = useState<SetupTab>("overview");
  const [openType, setOpenType] = useState<string | undefined>();
  const [openCategory, setOpenCategory] = useState<string | undefined>();
  // Shared by Questions and Rules, so switching tabs keeps your place.
  const [typeCode, setTypeCode] = useState("");
  const [trigger, setTrigger] = useState("");
  const [target, setTarget] = useState("");
  const [ruleMode, setRuleMode] = useState<"show" | "defaults">("show");
  const undoStack = useSetupStore((s) => s.undoStack);
  const undo = useSetupStore((s) => s.undo);
  const demoMode = useDemoStore((s) => s.demoMode);
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
  const problemCount = useMemo(() => (setup ? checkSetup(setup).filter((i) => i.severity === "error").length : 0), [setup]);
  return (
    <div className="sbp-page">
      <div className="sbp-tabs" data-tour="setup-tabs">
        <button type="button" className={`sbp-tab${tab === "overview" ? " sbp-tab--on" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button type="button" className={`sbp-tab${tab === "categories" ? " sbp-tab--on" : ""}`} onClick={() => setTab("categories")}>
          Categories
        </button>
        <button type="button" className={`sbp-tab${tab === "types" ? " sbp-tab--on" : ""}`} onClick={() => setTab("types")}>
          Sign Types
        </button>
        <button type="button" className={`sbp-tab${tab === "questions" ? " sbp-tab--on" : ""}`} onClick={() => setTab("questions")}>
          Questions
        </button>
        <button type="button" className={`sbp-tab${tab === "rules" ? " sbp-tab--on" : ""}`} onClick={() => setTab("rules")}>
          Rules
        </button>
        <button type="button" className={`sbp-tab${tab === "descriptions" ? " sbp-tab--on" : ""}`} onClick={() => setTab("descriptions")}>
          Descriptions
        </button>
        <button type="button" className={`sbp-tab${tab === "materials" ? " sbp-tab--on" : ""}`} onClick={() => setTab("materials")}>
          Materials &amp; Items
        </button>
        <button type="button" className={`sbp-tab${tab === "check" ? " sbp-tab--on" : ""}`} onClick={() => setTab("check")}>
          Check Setup{problemCount > 0 && <span className="sbp-tab__count">{problemCount}</span>}
        </button>
        <div className="sbp-spacer" />
        <button
          type="button"
          className="btn-secondary sbp-undo"
          disabled={undoStack.length === 0}
          title={undoStack.length ? `Undo: ${undoStack[undoStack.length - 1]!.label}` : "Nothing to undo this session"}
          onClick={undo}
          data-tour="setup-undo"
        >
          ↶ Undo{undoStack.length ? ` (${undoStack.length})` : ""}
        </button>
      </div>

      {tab === "categories" && (
        <Categories
          key={openCategory ?? ""}
          initialCode={openCategory}
          onOpenType={(code) => {
            setOpenType(code);
            setTab("types");
          }}
        />
      )}
      {tab === "types" && <SignTypes key={openType ?? ""} initialCode={openType} />}
      {tab === "questions" && (
        <DecisionTree
          typeCode={typeCode}
          setTypeCode={setTypeCode}
          onOpenMatrix={(trig, tgt) => {
            setTrigger(trig);
            if (tgt) {
              setTarget(tgt);
              setRuleMode("defaults");
            } else setRuleMode("show");
            setTab("rules");
          }}
        />
      )}
      {tab === "rules" && (
        <RuleMatrix
          typeCode={typeCode}
          setTypeCode={setTypeCode}
          trigger={trigger}
          setTrigger={setTrigger}
          target={target}
          setTarget={setTarget}
          mode={ruleMode}
          setMode={setRuleMode}
        />
      )}
      {tab === "descriptions" && <Descriptions typeCode={typeCode} setTypeCode={setTypeCode} />}
      {tab === "materials" && <MaterialsItems />}
      {tab === "check" && (
        <CheckSetup
          onOpenCategory={(code) => {
            setOpenCategory(code);
            setTab("categories");
          }}
          onOpenType={(code, area) => {
            if (area === "descriptions") {
              setTypeCode(code);
              setTab("descriptions");
              return;
            }
            setOpenType(code);
            setTab("types");
          }}
        />
      )}

      {tab === "overview" && (
      <>
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
        {demoMode ? (
          // An import here would only replace the sandbox's copy — easy to mistake for the real thing.
          <div className="sbp-banner sbp-banner--warn">You're in the demo sandbox — exit the demo (banner at the top) to import the setup.</div>
        ) : (
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={(e) => void onFile(e.target.files?.[0])} />
        )}
        {error && <div className="sbp-banner sbp-banner--error" style={{ marginTop: 10 }}>{error}</div>}
        {done && <div className="sbp-banner sbp-banner--ok" style={{ marginTop: 10 }}>{done}</div>}
      </div>

      <div className="sbp-card">
        <div className="sbp-caption">Setup tools</div>
        <p className="sbp-muted" style={{ fontSize: 13 }}>
          <b>Categories</b>, <b>Sign Types</b>, <b>Questions</b>, <b>Rules</b>, <b>Descriptions</b>, <b>Materials &amp; Items</b> and <b>Check Setup</b> are ready (tabs above). Coming
          next: Saved Versions, Show Path, Test Category, Question Blocks, Copy/Paste, Stage Checklist and Spec References.
        </p>
      </div>
      </>
      )}

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
