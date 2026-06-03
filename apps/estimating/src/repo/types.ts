// Repo interfaces. The Estimating app talks to data through these — a local
// in-memory impl is supplied today (LocalCatalogRepo / LocalEstimateRepo); a
// Dataverse impl will plug in here later (Linear ALE-234 / ALE-236) without
// the UI having to change.

import type { CatalogItem } from '../data/catalog';
import type { WorkCode } from '../data/workcodes';
import type { Project } from '../lib/engine';

export interface CatalogRepo {
  list(): Promise<readonly CatalogItem[]>;
  search(query: string, limit?: number): Promise<readonly CatalogItem[]>;
  findByNo(itemNo: string): Promise<CatalogItem | undefined>;
  listWorkCodes(): Promise<readonly WorkCode[]>;
}

export interface EstimateRepo {
  list(): Promise<readonly Project[]>;
  get(id: string): Promise<Project | undefined>;
  save(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
}
