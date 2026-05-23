// Data-access interface for the Sign Specifications table.
//
// In production the Power Apps SDK injects a typed Dataverse client; we layer
// this thin interface over the top so the React components don't care whether
// they're hitting Dataverse, an in-memory mock, or the localStorage dev
// fallback used until `pac code push` is wired up.

import type { SignSpec } from "../domain/SignSpec";

export interface SignSpecRepo {
  list(): Promise<SignSpec[]>;
  save(spec: SignSpec): Promise<SignSpec>;
  load(id: string): Promise<SignSpec | null>;
  remove(id: string): Promise<void>;
}

// localStorage fallback. Active when running under `vite dev` outside the
// Power Apps host. The Dataverse adapter that ships in the `pac code push`
// bundle will replace this at runtime once the SDK is integrated.
const STORAGE_KEY = "signbuilderpro.specs.v1";

function readAll(): SignSpec[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(specs: SignSpec[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(specs));
}

export const localSignSpecRepo: SignSpecRepo = {
  async list() {
    return readAll().sort((a, b) => (a.productCode > b.productCode ? -1 : 1));
  },
  async save(spec) {
    const all = readAll();
    const id = spec.id ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const next = { ...spec, id };
    const i = all.findIndex((s) => s.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeAll(all);
    return next;
  },
  async load(id) {
    return readAll().find((s) => s.id === id) ?? null;
  },
  async remove(id) {
    writeAll(readAll().filter((s) => s.id !== id));
  },
};

// Single export the screens import. Swap to a Dataverse-backed repo here once
// the Power Apps SDK client is wired in `pac code init`.
export const signSpecs: SignSpecRepo = localSignSpecRepo;
