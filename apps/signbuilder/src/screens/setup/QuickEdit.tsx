import { useEffect, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { ContextMenu, PromptDialog, type MenuItem } from "../../components/ContextMenu";
import { Modal } from "../../components/ui";
import type { Question } from "../../domain/types";
import { sameAnswer } from "../../engine/values";
import { addOption, addQuestion, codeFromPrompt, deleteQuestion, moveOption, removeOption, updateOption, updateQuestion } from "../../setup/question-ops";
import { useSetupStore } from "../../store/setup-store";
import { QuestionEditor } from "./DecisionTree";

/** Where the right-click was: a question, and the answer button under the mouse (if any). */
export interface QuickTarget {
  x: number;
  y: number;
  typeCode: string;
  questionCode: string;
  answer?: string;
}

type Dialog =
  | { kind: "renameQuestion" | "hint" | "addAnswer" | "addQuestion" | "renameAnswer" | "printsAs" }
  | { kind: "deleteQuestion" | "removeAnswer" }
  | { kind: "edit"; code: string };

/** Right-click editing on Test & Path: change a question or answer on the spot
 *  (every change goes through Undo like the Setup tabs). */
export default function QuickEdit({
  target,
  onRenamedAnswer,
  onOpenInQuestions,
}: {
  target: QuickTarget | null;
  /** The test sign keeps its pick when an answer it uses is renamed. */
  onRenamedAnswer: (questionCode: string, from: string, to: string) => void;
  onOpenInQuestions: (typeCode: string, questionCode: string) => void;
}) {
  const setup = useSetupStore((s) => s.setup);
  const idx = useSetupStore((s) => s.idx);
  const replace = useSetupStore((s) => s.replace);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // The target the open dialog is about (the next right-click doesn't change it).
  const [t, setT] = useState<QuickTarget | null>(null);

  useEffect(() => {
    if (!target) return;
    setT(target);
    setDialog(null);
    setMenu(true);
  }, [target]);

  if (!setup || !idx || !t) return null;
  const q = idx.question(t.typeCode, t.questionCode);
  if (!q && dialog?.kind !== "edit") return null;
  const isList = (x: Question) => x.answerType === "option" || x.answerType === "yesno";
  const option = q && t.answer ? idx.option(t.typeCode, q.code, t.answer) : undefined;
  const answers = q ? idx.options(t.typeCode, q.code) : [];
  const pos = option ? answers.findIndex((o) => o.value === option.value) : -1;
  const close = () => setDialog(null);

  const items: MenuItem[] = [];
  if (q && option) {
    items.push(
      { label: "Rename this answer…", onClick: () => setDialog({ kind: "renameAnswer" }) },
      { label: option.outputText ? `Prints as “${option.outputText}”…` : "Print it differently…", onClick: () => setDialog({ kind: "printsAs" }) },
      sameAnswer(q.defaultValue, option.value)
        ? { label: "Stop it being the default", onClick: () => replace(updateQuestion(setup, t.typeCode, q.code, { defaultValue: "" }), `No default for ${q.code}`) }
        : { label: "Make it the default", onClick: () => replace(updateQuestion(setup, t.typeCode, q.code, { defaultValue: option.value }), `Default ${q.code} = ${option.value}`) },
      { label: "Move left", disabled: pos <= 0, onClick: () => replace(moveOption(setup, t.typeCode, q.code, option.value, -1), `Move answer ${option.value}`) },
      { label: "Move right", disabled: pos < 0 || pos >= answers.length - 1, onClick: () => replace(moveOption(setup, t.typeCode, q.code, option.value, 1), `Move answer ${option.value}`) },
      { label: "Remove this answer…", danger: true, onClick: () => setDialog({ kind: "removeAnswer" }) },
    );
  }
  if (q) {
    items.push(
      { label: "Rename the question…", divider: items.length > 0, onClick: () => setDialog({ kind: "renameQuestion" }) },
      ...(isList(q) ? [{ label: "Add an answer…", onClick: () => setDialog({ kind: "addAnswer" }) }] : []),
      q.required
        ? { label: "Make it optional", onClick: () => replace(updateQuestion(setup, t.typeCode, q.code, { required: false }), `${q.code} optional`) }
        : { label: "Make it required", onClick: () => replace(updateQuestion(setup, t.typeCode, q.code, { required: true }), `${q.code} required`) },
      { label: q.hint ? "Change the hint…" : "Add a hint…", onClick: () => setDialog({ kind: "hint" }) },
      { label: "Add a question after this…", onClick: () => setDialog({ kind: "addQuestion" }) },
      { label: "Edit everything about it…", onClick: () => setDialog({ kind: "edit", code: q.code }) },
      { label: "Open on the Questions tab", onClick: () => onOpenInQuestions(t.typeCode, q.code) },
      { label: "Delete the question…", danger: true, onClick: () => setDialog({ kind: "deleteQuestion" }) },
    );
  }

  const title = option ? `“${option.value}” · ${q!.prompt}` : q ? `${q.prompt} (${q.code})` : "";
  const type = t.typeCode;
  const answerError = (v: string, except = "") => {
    if (!v.trim()) return "Enter the answer.";
    if (answers.some((o) => sameAnswer(o.value, v) && !sameAnswer(o.value, except))) return "That's already an answer.";
    return "";
  };

  return (
    <>
      {menu && <ContextMenu x={t.x} y={t.y} title={title} items={items} onClose={() => setMenu(false)} />}

      {q && dialog?.kind === "renameQuestion" && (
        <PromptDialog
          title="Rename the question"
          label="Question (as asked)"
          initial={q.prompt}
          help={`Only on this sign type (${type}).`}
          validate={(v) => (v.trim() ? "" : "Enter the question.")}
          onCancel={close}
          onOk={(v) => {
            replace(updateQuestion(setup, type, q.code, { prompt: v.trim() }), `Rename ${q.code}`);
            close();
          }}
        />
      )}
      {q && dialog?.kind === "hint" && (
        <PromptDialog
          title="Hint"
          label="Shown under the question"
          initial={q.hint}
          okLabel="Save"
          onCancel={close}
          onOk={(v) => {
            replace(updateQuestion(setup, type, q.code, { hint: v.trim() }), `Hint of ${q.code}`);
            close();
          }}
        />
      )}
      {q && dialog?.kind === "addAnswer" && (
        <PromptDialog
          title={`Add an answer to “${q.prompt}”`}
          label="Answer"
          okLabel="Add"
          validate={(v) => answerError(v)}
          onCancel={close}
          onOk={(v) => {
            replace(addOption(setup, type, q.code, v), `Add answer ${v.trim()} to ${q.code}`);
            close();
          }}
        />
      )}
      {q && option && dialog?.kind === "renameAnswer" && (
        <PromptDialog
          title="Rename the answer"
          label="Answer"
          initial={option.value}
          help="Its rules, defaults and description conditions on this sign type follow the new wording."
          validate={(v) => answerError(v, option.value)}
          onCancel={close}
          onOk={(v) => {
            const to = v.trim();
            replace(updateOption(setup, type, q.code, option.value, { value: to }), `Rename answer ${option.value} → ${to}`);
            onRenamedAnswer(q.code, option.value, to);
            close();
          }}
        />
      )}
      {q && option && dialog?.kind === "printsAs" && (
        <PromptDialog
          title={`How “${option.value}” prints`}
          label="Prints as (blank = the answer itself)"
          initial={option.outputText}
          help="Changes the Production / Field Description wording only — people still pick the answer as it is."
          onCancel={close}
          onOk={(v) => {
            replace(updateOption(setup, type, q.code, option.value, { outputText: v.trim() }), `Prints as for ${option.value}`);
            close();
          }}
        />
      )}
      {q && dialog?.kind === "addQuestion" && (
        <PromptDialog
          title={`Add a question after “${q.prompt}”`}
          label="Question (as asked)"
          okLabel="Add"
          help="It's asked always, as a pick list — add its answers and rules in the editor that opens next."
          validate={(v) => (v.trim() ? "" : "Enter the question.")}
          onCancel={close}
          onOk={(v) => {
            const code = codeFromPrompt(setup, type, v);
            replace(addQuestion(setup, type, code, v, q), `Add question ${code}`);
            setDialog({ kind: "edit", code });
          }}
        />
      )}
      {q && option && dialog?.kind === "removeAnswer" && (
        <ConfirmDialog
          title={`Remove “${option.value}”?`}
          message={`It's removed from “${q.prompt}” on ${type}, with the rules that stand on it. Undo brings it back.`}
          confirmLabel="Remove"
          danger
          onCancel={close}
          onConfirm={() => {
            replace(removeOption(setup, type, q.code, option.value), `Remove answer ${option.value} from ${q.code}`);
            close();
          }}
        />
      )}
      {q && dialog?.kind === "deleteQuestion" && (
        <ConfirmDialog
          title={`Delete “${q.prompt}”?`}
          message={`The question is removed from ${type} with its answers and every rule about it. Undo brings it back.`}
          confirmLabel="Delete"
          danger
          onCancel={close}
          onConfirm={() => {
            replace(deleteQuestion(setup, type, q.code), `Delete question ${q.code}`);
            close();
          }}
        />
      )}
      {dialog?.kind === "edit" && idx.question(type, dialog.code) && (
        <Modal title="Edit question" onClose={close} wide>
          <div className="sbp-quick-editor">
            <QuestionEditor idx={idx} q={idx.question(type, dialog.code)!} onDeleted={close} />
          </div>
        </Modal>
      )}
    </>
  );
}
