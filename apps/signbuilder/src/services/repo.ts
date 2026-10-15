/**
 * Where the Sign Builder keeps its data.
 *
 *  - mock (npm run dev): the browser's localStorage, seeded with the demo
 *    setup — edits survive a reload, nothing leaves the machine.
 *  - live (deployed / VITE_DATA_SOURCE=live): Dataverse, crfdf_sb* tables
 *    (scripts/create-signbuilder-tables.ps1).
 *
 * The setup is stored as JSON documents — "core" plus one "type:<CODE>" per
 * sign type or question block — so editing a sign type is one write, and an
 * undo step / version is just a copy of a document.
 */
import { DEMO_SETUP } from "../data/demo-setup";
import type {
  DetailLevel,
  Project,
  SetupData,
  SignLine,
  Spec,
  SpecPurpose,
  SpecReference,
  SpecStatus,
  StoredAnswer,
} from "../domain/types";
import { dvCreate, dvDelete, dvUpdate, listAll, odataLit, type Row } from "./dataverse-core";

export const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface SignBuilderRepo {
  kind: "mock" | "live";
  loadSetup(): Promise<SetupData>;
  /** Writes the setup documents that changed since the last load / save. */
  saveSetup(setup: SetupData): Promise<void>;
  /** Spec reference images (loaded only when shown in live mode). */
  loadReferenceImages(code: string): Promise<Pick<SpecReference, "thumbnail" | "fullImage">>;
  saveReference(ref: SpecReference): Promise<void>;
  deleteReference(code: string): Promise<void>;
  loadSpecs(): Promise<Spec[]>;
  saveSpec(spec: Spec): Promise<void>;
  deleteSpec(id: string): Promise<void>;
  loadLines(): Promise<SignLine[]>;
  saveLine(line: SignLine): Promise<void>;
  deleteLine(id: string): Promise<void>;
  loadProjects(): Promise<Project[]>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Setup <-> documents
// ---------------------------------------------------------------------------

type SetupDocs = Map<string, string>;

/** Splits the setup into its documents (references are stored separately). */
export function setupToDocs(setup: SetupData): SetupDocs {
  const docs: SetupDocs = new Map();
  docs.set(
    "core",
    JSON.stringify({
      sections: setup.sections,
      categories: setup.categories,
      settings: setup.settings,
      checklist: setup.checklist,
      vinylColors: setup.vinylColors,
      references: setup.references.map(({ thumbnail: _t, fullImage: _f, ...rest }) => rest),
    }),
  );
  for (const t of setup.signTypes) {
    const by = <T extends { signTypeCode: string }>(list: T[]) => list.filter((x) => x.signTypeCode === t.code);
    docs.set(
      `type:${t.code}`,
      JSON.stringify({
        signType: t,
        questions: by(setup.questions),
        options: by(setup.options),
        rules: by(setup.rules),
        templates: by(setup.templates),
        referenceRules: by(setup.referenceRules),
        defaultRules: by(setup.defaultRules ?? []),
        blockUsages: by(setup.blockUsages),
      }),
    );
  }
  return docs;
}

export function docsToSetup(docs: SetupDocs): SetupData {
  const setup: SetupData = {
    sections: [], categories: [], signTypes: [], questions: [], options: [], rules: [], defaultRules: [], templates: [],
    blockUsages: [], references: [], referenceRules: [], vinylColors: [], checklist: [],
    settings: { specReferenceFolderUrl: "", checkSpecsOnRelease: true },
  };
  const core = docs.get("core");
  if (core) {
    const c = JSON.parse(core);
    setup.sections = c.sections ?? [];
    setup.categories = c.categories ?? [];
    setup.settings = c.settings ?? setup.settings;
    setup.checklist = c.checklist ?? [];
    setup.vinylColors = c.vinylColors ?? [];
    setup.references = c.references ?? [];
  }
  for (const [key, json] of docs) {
    if (!key.startsWith("type:")) continue;
    const d = JSON.parse(json);
    setup.signTypes.push(d.signType);
    setup.questions.push(...(d.questions ?? []));
    setup.options.push(...(d.options ?? []));
    setup.rules.push(...(d.rules ?? []));
    setup.templates.push(...(d.templates ?? []));
    setup.referenceRules.push(...(d.referenceRules ?? []));
    setup.blockUsages.push(...(d.blockUsages ?? []));
    setup.defaultRules.push(...(d.defaultRules ?? []));
  }
  return setup;
}

// ---------------------------------------------------------------------------
// Mock (localStorage)
// ---------------------------------------------------------------------------

const MOCK_KEY = "signbuilder.mock.v1";

export interface MockSeed {
  setup: SetupData;
  specs: Spec[];
  lines: SignLine[];
  projects: Project[];
}

interface MockState {
  docs: [string, string][];
  references: SpecReference[];
  specs: Spec[];
  lines: SignLine[];
  projects: Project[];
}

type RefImages = Pick<SpecReference, "thumbnail" | "fullImage">;

/** The dev mock keeps reference images in IndexedDB — the real setup's are
 *  ~10 MB, more than localStorage holds. */
const IMAGE_DB = "signbuilder.mock.images";

function imageStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IMAGE_DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("images");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("images", mode);
      const req = fn(tx.objectStore("images"));
      tx.oncomplete = () => {
        db.close();
        resolve(req ? (req.result as T) : undefined);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

const hasImages = (r: SpecReference) => !!(r.thumbnail || r.fullImage);
const stripImages = ({ thumbnail: _t, fullImage: _f, ...rest }: SpecReference): SpecReference => rest;

/** A repo in the browser. With a storage key it survives a reload (dev mock —
 *  images in IndexedDB); without one it lives in memory only (the demo
 *  sandbox). `imagesFrom` supplies reference images the seed doesn't carry. */
export function createMockRepo(storageKey: string | null = MOCK_KEY, seed?: MockSeed, imagesFrom?: SignBuilderRepo): SignBuilderRepo {
  const persistent = !!storageKey && !seed;
  const load = (): MockState => {
    if (seed) return { docs: [...setupToDocs(seed.setup)], references: seed.setup.references, specs: seed.specs, lines: seed.lines, projects: seed.projects };
    try {
      const raw = storageKey ? localStorage.getItem(storageKey) : null;
      if (raw) return JSON.parse(raw) as MockState;
    } catch {
      /* fall through to the seed */
    }
    return { docs: [...setupToDocs(DEMO_SETUP)], references: DEMO_SETUP.references, specs: [], lines: [], projects: [] };
  };
  let state = load();
  const save = () => {
    if (!persistent || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...state, references: state.references.map(stripImages) }));
    } catch (e) {
      console.warn("[mock] couldn't save to localStorage (too big?)", e);
    }
  };
  /** Persistent: images go to IndexedDB and the in-memory list keeps the rest. */
  const keepReferences = async (refs: SpecReference[]): Promise<SpecReference[]> => {
    if (!persistent) return refs;
    const withImages = refs.filter(hasImages);
    if (withImages.length > 0) {
      await imageStore("readwrite", (store) => {
        for (const r of withImages) store.put({ thumbnail: r.thumbnail, fullImage: r.fullImage } satisfies RefImages, r.code);
      });
    }
    return refs.map(stripImages);
  };
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 40));
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item;
    else list.push(item);
  };

  return {
    kind: "mock",
    async loadSetup() {
      const setup = docsToSetup(new Map(state.docs));
      setup.references = state.references.map((r) => ({ ...r }));
      return delay(setup);
    },
    async saveSetup(setup) {
      state.docs = [...setupToDocs(setup)];
      state.references = await keepReferences(setup.references);
      save();
      return delay(undefined);
    },
    async loadReferenceImages(code) {
      const r = state.references.find((x) => x.code === code);
      if (r && hasImages(r)) return delay({ thumbnail: r.thumbnail, fullImage: r.fullImage });
      if (persistent) {
        const stored = await imageStore<RefImages>("readonly", (store) => store.get(code));
        if (stored) return stored;
      }
      if (imagesFrom) return imagesFrom.loadReferenceImages(code);
      return delay({});
    },
    async saveReference(ref) {
      const [kept] = await keepReferences([ref]);
      const i = state.references.findIndex((x) => x.code === ref.code);
      if (i >= 0) state.references[i] = kept!;
      else state.references.push(kept!);
      save();
      return delay(undefined);
    },
    async deleteReference(code) {
      state.references = state.references.filter((x) => x.code !== code);
      if (persistent) await imageStore("readwrite", (store) => store.delete(code));
      save();
      return delay(undefined);
    },
    async loadSpecs() {
      return delay(state.specs.map((s) => ({ ...s })));
    },
    async saveSpec(spec) {
      upsert(state.specs, spec);
      save();
      return delay(undefined);
    },
    async deleteSpec(id) {
      state.specs = state.specs.filter((s) => s.id !== id);
      state.lines = state.lines.filter((l) => l.specId !== id);
      save();
      return delay(undefined);
    },
    async loadLines() {
      return delay(state.lines.map((l) => ({ ...l })));
    },
    async saveLine(line) {
      upsert(state.lines, line);
      save();
      return delay(undefined);
    },
    async deleteLine(id) {
      state.lines = state.lines.filter((l) => l.id !== id);
      save();
      return delay(undefined);
    },
    async loadProjects() {
      return delay(state.projects.map((p) => ({ ...p })));
    },
    async saveProject(project) {
      upsert(state.projects, project);
      save();
      return delay(undefined);
    },
    async deleteProject(id) {
      state.projects = state.projects.filter((p) => p.id !== id);
      save();
      return delay(undefined);
    },
  };
}

// ---------------------------------------------------------------------------
// Live (Dataverse)
// ---------------------------------------------------------------------------

const SET = {
  doc: "crfdf_sbsetupdocs",
  reference: "crfdf_sbreferences",
  project: "crfdf_sbprojects",
  spec: "crfdf_sbspecs",
  line: "crfdf_sbsignlines",
};

const STATUSES: SpecStatus[] = ["draft", "submitted", "approved", "built"];
const DETAILS: DetailLevel[] = ["opportunity", "full"];
const PURPOSES: SpecPurpose[] = ["opportunity", "existingProject", "walkIn"];

const s = (v: unknown, fb = ""): string => (v == null ? fb : String(v));
const n = (v: unknown, fb = 0): number => (v == null || v === "" ? fb : Number(v));

function createLiveRepo(): SignBuilderRepo {
  // Which rows exist (so a save is an update, not a duplicate create), and the
  // last-saved JSON of each setup document (so only changed ones are written).
  const known = new Set<string>();
  const docIds = new Map<string, string>();
  const docJson = new Map<string, string>();
  const referenceIds = new Map<string, string>();

  const upsert = async (set: string, id: string, rec: Row, idCol: string) => {
    if (known.has(id)) await dvUpdate(set, id, rec);
    else {
      await dvCreate(set, { ...rec, [idCol]: id });
      known.add(id);
    }
  };

  const specFromRow = (r: Row): Spec => {
    known.add(s(r.crfdf_sbspecid));
    return {
      id: s(r.crfdf_sbspecid),
      number: s(r.crfdf_name),
      description: s(r.crfdf_description),
      purpose: PURPOSES[n(r.crfdf_purpose)] ?? "walkIn",
      status: STATUSES[n(r.crfdf_status)] ?? "draft",
      detailLevel: DETAILS[n(r.crfdf_detaillevel)] ?? "opportunity",
      opportunityNo: s(r.crfdf_opportunityno),
      jobNo: s(r.crfdf_jobno),
      projectId: s(r.crfdf_projectid),
      customerNo: s(r.crfdf_customerno),
      customerName: s(r.crfdf_customername),
      contactName: s(r.crfdf_contactname),
      designReference: s(r.crfdf_designreference),
      jobDetailNotes: s(r.crfdf_jobdetailnotes),
      createdAt: s(r.createdon),
      createdBy: s(r.crfdf_createdbyname),
      modifiedAt: s(r.modifiedon),
      lastGeneratedAt: s(r.crfdf_lastgeneratedat),
      approvedBy: s(r.crfdf_approvedby),
      approvedAt: s(r.crfdf_approvedat),
    };
  };

  const specToRow = (sp: Spec): Row => ({
    crfdf_name: sp.number,
    crfdf_description: sp.description,
    crfdf_purpose: PURPOSES.indexOf(sp.purpose),
    crfdf_status: STATUSES.indexOf(sp.status),
    crfdf_detaillevel: DETAILS.indexOf(sp.detailLevel),
    crfdf_opportunityno: sp.opportunityNo,
    crfdf_jobno: sp.jobNo,
    crfdf_projectid: sp.projectId,
    crfdf_customerno: sp.customerNo,
    crfdf_customername: sp.customerName,
    crfdf_contactname: sp.contactName,
    crfdf_designreference: sp.designReference,
    crfdf_jobdetailnotes: sp.jobDetailNotes,
    crfdf_createdbyname: sp.createdBy,
    crfdf_lastgeneratedat: sp.lastGeneratedAt,
    crfdf_approvedby: sp.approvedBy,
    crfdf_approvedat: sp.approvedAt,
  });

  const lineFromRow = (r: Row): SignLine => {
    known.add(s(r.crfdf_sbsignlineid));
    let answers: Record<string, StoredAnswer> = {};
    try {
      answers = JSON.parse(s(r.crfdf_answers, "{}"));
    } catch {
      /* a damaged answers field starts empty rather than breaking the spec */
    }
    return {
      id: s(r.crfdf_sbsignlineid),
      specId: s(r.crfdf_specid),
      lineNo: n(r.crfdf_lineno),
      signName: s(r.crfdf_name),
      categoryCode: s(r.crfdf_categorycode),
      signTypeCode: s(r.crfdf_signtypecode),
      quantity: n(r.crfdf_quantity, 1),
      answers,
      specCode: s(r.crfdf_speccode),
      specReferenceCode: s(r.crfdf_specreferencecode),
      typeDecided: r.crfdf_typedecided === true,
      completedPct: n(r.crfdf_completedpct),
    };
  };

  const lineToRow = (l: SignLine): Row => ({
    crfdf_name: l.signName,
    crfdf_specid: l.specId,
    crfdf_lineno: l.lineNo,
    crfdf_categorycode: l.categoryCode,
    crfdf_signtypecode: l.signTypeCode,
    crfdf_quantity: l.quantity,
    crfdf_answers: JSON.stringify(l.answers),
    crfdf_speccode: l.specCode,
    crfdf_specreferencecode: l.specReferenceCode,
    crfdf_typedecided: l.typeDecided,
    crfdf_completedpct: l.completedPct,
  });

  return {
    kind: "live",
    async loadSetup() {
      const rows = await listAll(SET.doc, { select: "crfdf_sbsetupdocid,crfdf_name,crfdf_json" });
      const docs: SetupDocs = new Map();
      docIds.clear();
      docJson.clear();
      for (const r of rows) {
        const key = s(r.crfdf_name);
        docs.set(key, s(r.crfdf_json));
        docIds.set(key, s(r.crfdf_sbsetupdocid));
        docJson.set(key, s(r.crfdf_json));
      }
      const refRows = await listAll(SET.reference, { select: "crfdf_sbreferenceid,crfdf_name,crfdf_description,crfdf_filename,crfdf_sharepointurl" });
      const setup = docsToSetup(docs);
      setup.references = refRows.map((r) => {
        referenceIds.set(s(r.crfdf_name), s(r.crfdf_sbreferenceid));
        return { code: s(r.crfdf_name), description: s(r.crfdf_description), fileName: s(r.crfdf_filename), sharePointUrl: s(r.crfdf_sharepointurl) };
      });
      return setup;
    },
    async saveSetup(setup) {
      const docs = setupToDocs(setup);
      for (const [key, json] of docs) {
        if (docJson.get(key) === json) continue;
        const id = docIds.get(key);
        if (id) await dvUpdate(SET.doc, id, { crfdf_json: json });
        else {
          const newId = crypto.randomUUID();
          await dvCreate(SET.doc, { crfdf_sbsetupdocid: newId, crfdf_name: key, crfdf_kind: key.split(":")[0], crfdf_json: json });
          docIds.set(key, newId);
        }
        docJson.set(key, json);
      }
      // Sign types that were deleted.
      for (const [key, id] of [...docIds]) {
        if (docs.has(key)) continue;
        await dvDelete(SET.doc, id);
        docIds.delete(key);
        docJson.delete(key);
      }
    },
    async loadReferenceImages(code) {
      const rows = await listAll(SET.reference, { select: "crfdf_thumbnail,crfdf_fullimage", filter: `crfdf_name eq '${odataLit(code)}'` });
      const r = rows[0];
      return { thumbnail: r ? s(r.crfdf_thumbnail) || undefined : undefined, fullImage: r ? s(r.crfdf_fullimage) || undefined : undefined };
    },
    async saveReference(ref) {
      const rec: Row = { crfdf_name: ref.code, crfdf_description: ref.description, crfdf_filename: ref.fileName, crfdf_sharepointurl: ref.sharePointUrl };
      if (ref.thumbnail !== undefined) rec.crfdf_thumbnail = ref.thumbnail;
      if (ref.fullImage !== undefined) rec.crfdf_fullimage = ref.fullImage;
      const id = referenceIds.get(ref.code);
      if (id) await dvUpdate(SET.reference, id, rec);
      else {
        const newId = crypto.randomUUID();
        await dvCreate(SET.reference, { ...rec, crfdf_sbreferenceid: newId });
        referenceIds.set(ref.code, newId);
      }
    },
    async deleteReference(code) {
      const id = referenceIds.get(code);
      if (id) await dvDelete(SET.reference, id);
      referenceIds.delete(code);
    },
    async loadSpecs() {
      return (await listAll(SET.spec)).map(specFromRow);
    },
    async saveSpec(spec) {
      await upsert(SET.spec, spec.id, specToRow(spec), "crfdf_sbspecid");
    },
    async deleteSpec(id) {
      await dvDelete(SET.spec, id);
      known.delete(id);
    },
    async loadLines() {
      return (await listAll(SET.line)).map(lineFromRow);
    },
    async saveLine(line) {
      await upsert(SET.line, line.id, lineToRow(line), "crfdf_sbsignlineid");
    },
    async deleteLine(id) {
      await dvDelete(SET.line, id);
      known.delete(id);
    },
    async loadProjects() {
      return (await listAll(SET.project)).map((r) => {
        known.add(s(r.crfdf_sbprojectid));
        return { id: s(r.crfdf_sbprojectid), name: s(r.crfdf_name), customerName: s(r.crfdf_customername), notes: s(r.crfdf_notes), createdAt: s(r.createdon) };
      });
    },
    async saveProject(p) {
      await upsert(SET.project, p.id, { crfdf_name: p.name, crfdf_customername: p.customerName, crfdf_notes: p.notes }, "crfdf_sbprojectid");
    },
    async deleteProject(id) {
      await dvDelete(SET.project, id);
      known.delete(id);
    },
  };
}

let repoInstance: SignBuilderRepo | null = null;
// The demo sandbox swaps in an in-memory repo; leaving it restores the real one.
let override: SignBuilderRepo | null = null;

export function repo(): SignBuilderRepo {
  if (override) return override;
  if (!repoInstance) repoInstance = LIVE ? createLiveRepo() : createMockRepo();
  return repoInstance;
}

export function setRepoOverride(r: SignBuilderRepo | null): void {
  override = r;
}
