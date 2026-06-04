// Local-only impls of CatalogRepo + EstimateRepo. Catalog reads from the
// generated data modules (extracted from the workbook); estimates persist to
// localStorage so the user's in-progress projects survive a reload.

import { CATALOG, type CatalogItem } from '../data/catalog';
import { WORK_CODES, type WorkCode } from '../data/workcodes';
import { searchCatalog } from '../lib/engine';
import { CNB_SAMPLE_ESTIMATE } from '../data/sampleEstimate';
import type { CatalogRepo, EstimateRepo } from './types';
import type { Project } from '../lib/engine';

const LS_KEY = 'lumineo.estimating.projects.v1';

export const LocalCatalogRepo: CatalogRepo = {
  async list() {
    return CATALOG;
  },
  async search(query, limit = 25) {
    return searchCatalog(query, limit);
  },
  async findByNo(itemNo) {
    return CATALOG.find(i => i.no === itemNo);
  },
  async listWorkCodes() {
    return WORK_CODES;
  },
};

function readStore(): Project[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function writeStore(projects: readonly Project[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(projects));
}

/** Always surface the completed CNB job (J36938) as a built-in example so the
 *  app ships with a real, fully worked estimate and proposal to look over. It
 *  is prepended to whatever the user has saved unless they've saved their own
 *  edit of it (same id), in which case theirs wins. Deleting it only clears it
 *  for the session — it returns on reload, by design. */
function withSample(stored: readonly Project[]): Project[] {
  if (stored.some(p => p.id === CNB_SAMPLE_ESTIMATE.id)) return [...stored];
  return [CNB_SAMPLE_ESTIMATE, ...stored];
}

export const LocalEstimateRepo: EstimateRepo = {
  async list() {
    return withSample(readStore());
  },
  async get(id) {
    return withSample(readStore()).find(p => p.id === id);
  },
  async save(project) {
    const all = readStore();
    const idx = all.findIndex(p => p.id === project.id);
    if (idx >= 0) all[idx] = project; else all.push(project);
    writeStore(all);
    return project;
  },
  async delete(id) {
    writeStore(readStore().filter(p => p.id !== id));
  },
};

// Re-exports so consumers just import { CatalogRepo, EstimateRepo } from './repo'.
export type { CatalogRepo, EstimateRepo, CatalogItem, WorkCode, Project };
