// Project repo — parallel to SignSpecRepo. Same shape so screens can stay
// backend-agnostic. The Dataverse adapter pulls Project rows from a sibling
// `lum_signproject` table; the localStorage fallback uses its own key so
// projects + signs persist independently in dev.

import type { Project } from "../domain/Project";

export interface ProjectRepo {
  list(): Promise<Project[]>;
  save(p: Project): Promise<Project>;
  load(id: string): Promise<Project | null>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = "signbuilderpro.projects.v1";

function readAll(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export const localProjectRepo: ProjectRepo = {
  async list() {
    return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async save(p) {
    const all = readAll();
    const id = p.id ?? `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const next: Project = { ...p, id };
    const i = all.findIndex((x) => x.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeAll(all);
    return next;
  },
  async load(id) {
    return readAll().find((p) => p.id === id) ?? null;
  },
  async remove(id) {
    writeAll(readAll().filter((p) => p.id !== id));
  },
};

// Re-export point so screens import `projects` and don't care which backend
// is active. The Dataverse adapter swaps this in at runtime when present.
export { activeProjectRepo as projects } from "./projectAdapter";
