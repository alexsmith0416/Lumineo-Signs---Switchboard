import { create } from "zustand";
import {
  createAppUser,
  deleteAppUser,
  fetchAppUsers,
  updateAppUser,
} from "../services/dataverse-live";
import type { UserType } from "../services/current-user";
import { persistOrReport } from "./write-status-store";
import { formatJobEditFields, parseJobEditFields } from "../services/job-edit-access";

/**
 * The editable login-role directory (crfdf_appuser). Loaded once at startup and
 * merged over the hardcoded USER_DIRECTORY by useCurrentUser (the table wins).
 * Managed from the in-app "Edit users" admin screen. Writes are optimistic and
 * resync on failure — same pattern as the other stores.
 *
 * Live-only persistence: in dev there's no Dataverse, so this stays empty and
 * useCurrentUser falls back to the code list; the admin panel still surfaces
 * that code list as read-only reference rows.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const newId = (): string => crypto.randomUUID();

export interface DirectoryUser {
  id: string;
  email: string;
  userType: UserType;
  displayName: string;
  /** Jobs-list fields this login may edit (granted in Manage users; [] = view only). */
  jobEditFields: string[];
  /** Warehouse Management: the site this login receives at ("" = none). */
  homeSite: string;
}

interface UserDirectoryState {
  users: DirectoryUser[];
  /** Lower-cased email → type, for fast lookup by useCurrentUser. */
  byEmail: Record<string, UserType>;
  /** Lower-cased email → the Jobs fields granted to that login. */
  jobFieldsByEmail: Record<string, string[]>;
  /** Lower-cased email → that login's home site (only logins that have one). */
  homeSiteByEmail: Record<string, string>;
  loaded: boolean;
  loading: boolean;

  load: (force?: boolean) => Promise<void>;
  addUser: (email: string, userType: UserType, displayName?: string) => Promise<void>;
  updateUser: (
    id: string,
    changes: { email?: string; userType?: UserType; displayName?: string; homeSite?: string },
  ) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  /** Grant exactly these Jobs fields to a login (replaces its grants). */
  setJobEditFields: (id: string, keys: string[]) => Promise<void>;
}

const indexByEmail = (users: DirectoryUser[]): Record<string, UserType> => {
  const m: Record<string, UserType> = {};
  for (const u of users) if (u.email) m[u.email.toLowerCase()] = u.userType;
  return m;
};

const indexJobFields = (users: DirectoryUser[]): Record<string, string[]> => {
  const m: Record<string, string[]> = {};
  for (const u of users) if (u.email && u.jobEditFields.length) m[u.email.toLowerCase()] = u.jobEditFields;
  return m;
};
const indexHomeSites = (users: DirectoryUser[]): Record<string, string> => {
  const m: Record<string, string> = {};
  for (const u of users) if (u.email && u.homeSite) m[u.email.toLowerCase()] = u.homeSite;
  return m;
};
const indexes = (users: DirectoryUser[]) => ({
  byEmail: indexByEmail(users),
  jobFieldsByEmail: indexJobFields(users),
  homeSiteByEmail: indexHomeSites(users),
});

export const useUserDirectoryStore = create<UserDirectoryState>((set, get) => ({
  users: [],
  byEmail: {},
  jobFieldsByEmail: {},
  homeSiteByEmail: {},
  loaded: false,
  loading: false,

  load: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    if (!LIVE) {
      set({ loaded: true, loading: false });
      return;
    }
    try {
      const rows = await fetchAppUsers();
      const users: DirectoryUser[] = rows.map((r) => ({
        id: r.id,
        email: r.email,
        userType: r.userType as UserType,
        displayName: r.displayName,
        jobEditFields: parseJobEditFields(r.jobEditFields),
        homeSite: r.homeSite,
      }));
      set({ users, ...indexes(users), loaded: true, loading: false });
    } catch (e) {
      // Leave users empty; useCurrentUser merges USER_DIRECTORY as the fallback.
      console.error("[user-directory] load failed — using code fallback", e);
      set({ loaded: true, loading: false });
    }
  },

  addUser: async (email, userType, displayName = "") => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    // Email is the key: updating an existing login re-points its role.
    const existing = get().users.find((u) => u.email === clean);
    if (existing) {
      await get().updateUser(existing.id, { userType, displayName });
      return;
    }
    const user: DirectoryUser = { id: newId(), email: clean, userType, displayName, jobEditFields: [], homeSite: "" };
    const users = [...get().users, user];
    set({ users, ...indexes(users) });
    if (LIVE) {
      void persistOrReport("Add user", () => createAppUser({ id: user.id, email: clean, userType, displayName }));
    }
  },

  updateUser: async (id, changes) => {
    const email = changes.email?.trim().toLowerCase();
    const users = get().users.map((u) =>
      u.id === id ? { ...u, ...changes, email: email ?? u.email } : u,
    );
    set({ users, ...indexes(users) });
    if (LIVE) {
      void persistOrReport("Edit user", () => updateAppUser(id, { ...changes, ...(email ? { email } : {}) }));
    }
  },

  removeUser: async (id) => {
    const users = get().users.filter((u) => u.id !== id);
    set({ users, ...indexes(users) });
    if (LIVE) {
      void persistOrReport("Delete user", () => deleteAppUser(id));
    }
  },

  setJobEditFields: async (id, keys) => {
    const clean = parseJobEditFields(formatJobEditFields(keys));
    const users = get().users.map((u) => (u.id === id ? { ...u, jobEditFields: clean } : u));
    set({ users, ...indexes(users) });
    if (LIVE) {
      void persistOrReport("Save Jobs edit fields", () => updateAppUser(id, { jobEditFields: formatJobEditFields(clean) }));
    }
  },
}));
