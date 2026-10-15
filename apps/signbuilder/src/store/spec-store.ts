import { create } from "zustand";
import type { DetailLevel, Project, SignLine, Spec } from "../domain/types";
import { answerQuestion, evaluate, newSignLine, retarget, setQuantity, type ClearedNotice } from "../engine/flow";
import { repo } from "../services/repo";
import { useSetupStore } from "./setup-store";
import { persistOrReport } from "./write-status-store";

export interface AnswerOutcome {
  error?: string;
  message?: string;
  cleared: ClearedNotice[];
}

interface SpecState {
  specs: Spec[];
  lines: SignLine[];
  projects: Project[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;

  createSpec: (init: Partial<Spec>, createdBy: string) => Spec;
  updateSpec: (id: string, patch: Partial<Spec>) => void;
  deleteSpec: (id: string) => void;
  /** Detail level changes re-run every sign of the spec. */
  setDetailLevel: (id: string, level: DetailLevel) => void;

  addSign: (specId: string, categoryCode: string) => SignLine | null;
  updateSign: (line: SignLine, label: string) => void;
  deleteSign: (id: string) => void;
  copySign: (id: string) => SignLine | null;
  setSignQuantity: (id: string, quantity: number) => string | undefined;
  answer: (lineId: string, questionCode: string, input: string, sizes?: number[]) => AnswerOutcome;
  /** Bring a sign in line with the current setup (new / removed questions). */
  refreshSign: (id: string) => void;

  saveProject: (p: Project) => void;
  deleteProject: (id: string) => void;
}

const nowIso = () => new Date().toISOString();

function nextSpecNumber(specs: Spec[]): string {
  let max = 0;
  for (const s of specs) {
    const m = /(\d+)$/.exec(s.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `SPEC-${String(max + 1).padStart(4, "0")}`;
}

export const useSpecStore = create<SpecState>((set, get) => {
  const specOf = (specId: string) => get().specs.find((s) => s.id === specId);
  const detailOf = (specId: string): DetailLevel => specOf(specId)?.detailLevel ?? "opportunity";
  const idx = () => useSetupStore.getState().idx;

  const putLine = (line: SignLine, label: string) => {
    set((s) => ({ lines: s.lines.some((l) => l.id === line.id) ? s.lines.map((l) => (l.id === line.id ? line : l)) : [...s.lines, line] }));
    void persistOrReport(label, () => repo().saveLine(line));
  };
  const touchSpec = (specId: string) => {
    const spec = specOf(specId);
    if (!spec) return;
    const updated = { ...spec, modifiedAt: nowIso() };
    set((s) => ({ specs: s.specs.map((x) => (x.id === specId ? updated : x)) }));
  };

  return {
    specs: [],
    lines: [],
    projects: [],
    loaded: false,
    error: "",

    load: async () => {
      try {
        const [specs, lines, projects] = await Promise.all([repo().loadSpecs(), repo().loadLines(), repo().loadProjects()]);
        set({ specs, lines, projects, loaded: true, error: "" });
      } catch (e) {
        set({ loaded: true, error: e instanceof Error ? e.message : String(e) });
      }
    },

    createSpec: (init, createdBy) => {
      const spec: Spec = {
        id: crypto.randomUUID(),
        number: nextSpecNumber(get().specs),
        description: "",
        purpose: init.opportunityNo ? "opportunity" : init.jobNo ? "existingProject" : "walkIn",
        status: "draft",
        detailLevel: init.jobNo ? "full" : "opportunity",
        opportunityNo: "",
        jobNo: "",
        projectId: "",
        customerNo: "",
        customerName: "",
        contactName: "",
        designReference: "",
        jobDetailNotes: "",
        createdAt: nowIso(),
        createdBy,
        modifiedAt: nowIso(),
        lastGeneratedAt: "",
        approvedBy: "",
        approvedAt: "",
        ...init,
      };
      set((s) => ({ specs: [...s.specs, spec] }));
      void persistOrReport("Create spec", () => repo().saveSpec(spec));
      return spec;
    },

    updateSpec: (id, patch) => {
      const spec = specOf(id);
      if (!spec) return;
      const updated = { ...spec, ...patch, modifiedAt: nowIso() };
      set((s) => ({ specs: s.specs.map((x) => (x.id === id ? updated : x)) }));
      void persistOrReport("Update spec", () => repo().saveSpec(updated));
    },

    deleteSpec: (id) => {
      const lines = get().lines.filter((l) => l.specId === id);
      set((s) => ({ specs: s.specs.filter((x) => x.id !== id), lines: s.lines.filter((l) => l.specId !== id) }));
      void persistOrReport("Delete spec", async () => {
        for (const l of lines) await repo().deleteLine(l.id);
        await repo().deleteSpec(id);
      });
    },

    setDetailLevel: (id, level) => {
      get().updateSpec(id, { detailLevel: level });
      const ix = idx();
      if (!ix) return;
      for (const line of get().lines.filter((l) => l.specId === id)) {
        putLine(evaluate(ix, line, level).line, "Update sign");
      }
    },

    addSign: (specId, categoryCode) => {
      const ix = idx();
      if (!ix) return null;
      const existing = get().lines.filter((l) => l.specId === specId);
      const lineNo = (existing.reduce((m, l) => Math.max(m, l.lineNo), 0) || 0) + 10000;
      const line = newSignLine(ix, specId, lineNo, categoryCode, detailOf(specId));
      putLine(line, "Add sign");
      touchSpec(specId);
      return line;
    },

    updateSign: (line, label) => {
      putLine(line, label);
      touchSpec(line.specId);
    },

    deleteSign: (id) => {
      set((s) => ({ lines: s.lines.filter((l) => l.id !== id) }));
      void persistOrReport("Delete sign", () => repo().deleteLine(id));
    },

    copySign: (id) => {
      const src = get().lines.find((l) => l.id === id);
      if (!src) return null;
      const siblings = get().lines.filter((l) => l.specId === src.specId);
      const copy: SignLine = {
        ...src,
        id: crypto.randomUUID(),
        lineNo: siblings.reduce((m, l) => Math.max(m, l.lineNo), 0) + 10000,
        signName: src.signName ? `${src.signName} (copy)` : "",
        answers: JSON.parse(JSON.stringify(src.answers)),
      };
      putLine(copy, "Copy sign");
      return copy;
    },

    setSignQuantity: (id, quantity) => {
      const ix = idx();
      const line = get().lines.find((l) => l.id === id);
      if (!ix || !line) return undefined;
      try {
        putLine(setQuantity(ix, line, detailOf(line.specId), quantity).line, "Change quantity");
        return undefined;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },

    answer: (lineId, questionCode, input, sizes) => {
      const ix = idx();
      const line = get().lines.find((l) => l.id === lineId);
      if (!ix || !line) return { error: "This sign isn't loaded.", cleared: [] };
      try {
        const res = answerQuestion(ix, line, detailOf(line.specId), questionCode, input, sizes);
        putLine(res.evaluation.line, "Answer question");
        touchSpec(line.specId);
        return { message: res.message, cleared: res.evaluation.cleared };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e), cleared: [] };
      }
    },

    refreshSign: (id) => {
      const ix = idx();
      const line = get().lines.find((l) => l.id === id);
      if (!ix || !line) return;
      const typeCode = ix.signType(line.signTypeCode) ? line.signTypeCode : ix.firstSignType(line.categoryCode)?.code ?? "";
      const re = retarget(ix, line, typeCode, false);
      putLine(evaluate(ix, re, detailOf(line.specId)).line, "Refresh sign");
    },

    saveProject: (p) => {
      set((s) => ({ projects: s.projects.some((x) => x.id === p.id) ? s.projects.map((x) => (x.id === p.id ? p : x)) : [...s.projects, p] }));
      void persistOrReport("Save project", () => repo().saveProject(p));
    },

    deleteProject: (id) => {
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      void persistOrReport("Delete project", () => repo().deleteProject(id));
    },
  };
});
