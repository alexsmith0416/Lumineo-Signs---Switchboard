import { useEffect, useState } from "react";
import { personByCode } from "./sales-pm";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** The roster a shared floor login drives. */
export type FloorGroup = "production" | "install";

/** Employee roster groups (one store each). */
export type EmployeeGroup = "production" | "install-wk" | "install-nek";

// Shared floor logins → the roster they belong to. These are the ONE-account-each
// logins for the Production floor and the Installation crews; the person then
// picks their own name. Everyone NOT listed here (admin / ops on their own
// Microsoft login) gets the "Employee Schedules" browser instead.
//
// Fill in the real shared-account emails once they're created, e.g.:
//   "production@lumineosigns.com": "production",
//   "installation@lumineosigns.com": "install",
export const SHARED_FLOOR_ACCOUNTS: Record<string, FloorGroup> = {};

export type Role =
  | { kind: "floor"; group: FloorGroup }
  | { kind: "sales"; code: string }
  | { kind: "pm"; code: string }
  | { kind: "admin" };

// --- User type / access model ------------------------------------------------
// Every login has a TYPE that decides (a) which screen it opens on, and (b) what
// it may see — $ values and Monthly Gameplanning are Admin/Ops only. Fill
// USER_DIRECTORY from the roster (email → type); unlisted logins fall back to a
// derived type (shared floor account, Sales/PM code, else admin).
export type UserType =
  | "admin"
  | "ops"
  | "production"
  | "install-wk"
  | "install-nek"
  | "sales"
  | "pm";

export type AppView =
  | "my-schedule"
  | "production"
  | "installation"
  | "shipping"
  | "scenario"
  | "monthly";

export interface Permissions {
  /** May see $ values (the $ toggle + dollar figures / billing stats). */
  money: boolean;
  /** May see the Monthly Gameplanning view. */
  monthly: boolean;
}

interface TypeConfig {
  label: string;
  /** Screen the app opens on for this type. */
  defaultView: AppView;
  money: boolean;
  monthly: boolean;
  /** For installers: which install region their board defaults to. */
  installRegion?: "WK" | "NEK";
}

export const TYPE_CONFIG: Record<UserType, TypeConfig> = {
  admin: { label: "Admin", defaultView: "production", money: true, monthly: true },
  ops: { label: "Ops", defaultView: "production", money: true, monthly: true },
  production: { label: "Production", defaultView: "production", money: false, monthly: false },
  "install-wk": { label: "WK Install", defaultView: "installation", money: false, monthly: false, installRegion: "WK" },
  "install-nek": { label: "NEK Install", defaultView: "installation", money: false, monthly: false, installRegion: "NEK" },
  sales: { label: "Sales", defaultView: "my-schedule", money: false, monthly: false },
  pm: { label: "Project Manager", defaultView: "my-schedule", money: false, monthly: false },
};

// Roster: login email (lower-case) → user type. Fill this from the provided list.
//   "asmith@lumineosigns.com": "admin",
//   "jdoe@lumineosigns.com": "install-nek",
export const USER_DIRECTORY: Record<string, UserType> = {};

/** Resolve a login's user type: the directory wins, else derive a sensible one. */
export function resolveUserType(upn: string | undefined): UserType {
  const email = upn?.trim().toLowerCase();
  if (email && USER_DIRECTORY[email]) return USER_DIRECTORY[email];
  // Fallbacks until the directory is filled:
  const group = email ? SHARED_FLOOR_ACCOUNTS[email] : undefined;
  if (group === "production") return "production";
  if (group === "install") return "install-wk";
  const person = personByCode(email?.split("@")[0]);
  if (person?.type === "sales") return "sales";
  if (person?.type === "pm") return "pm";
  return "admin";
}

/**
 * The "My" screen behavior implied by a user type. Sales/PM sign in with
 * <code>@lumineosigns.com — the email local-part IS their code (ccarson@ →
 * CCARSON).
 */
export function roleForType(type: UserType, upn: string | undefined): Role {
  const local = upn?.trim().toLowerCase().split("@")[0];
  const code = personByCode(local)?.code ?? (local ?? "").toUpperCase();
  switch (type) {
    case "production":
      return { kind: "floor", group: "production" };
    case "install-wk":
    case "install-nek":
      return { kind: "floor", group: "install" };
    case "sales":
      return { kind: "sales", code };
    case "pm":
      return { kind: "pm", code };
    default:
      return { kind: "admin" };
  }
}

/** Back-compat: the role for a signed-in login. */
export function resolveRole(upn: string | undefined): Role {
  return roleForType(resolveUserType(upn), upn);
}

export interface CurrentUser {
  loading: boolean;
  fullName?: string;
  /** userPrincipalName (email) of the signed-in Microsoft account. */
  upn?: string;
  type: UserType;
  role: Role;
  permissions: Permissions;
  /** Screen the app should open on for this user. */
  defaultView: AppView;
  /** Preferred install region (for installer types). */
  installRegion?: "WK" | "NEK";
}

/**
 * The signed-in Microsoft user, read from the Power Apps Code App context.
 * In dev/mock mode there's no host context, so we return a stand-in admin user.
 */
export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<{ loading: boolean; fullName?: string; upn?: string }>({
    loading: true,
  });
  useEffect(() => {
    if (!LIVE) {
      setState({ loading: false, fullName: "Dev User", upn: "dev@local" });
      return;
    }
    let alive = true;
    void import("@microsoft/power-apps/app")
      .then(({ getContext }) => getContext())
      .then((ctx) => {
        if (alive) {
          setState({
            loading: false,
            fullName: ctx.user.fullName,
            upn: ctx.user.userPrincipalName,
          });
        }
      })
      .catch(() => {
        if (alive) setState({ loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);
  const type = resolveUserType(state.upn);
  const cfg = TYPE_CONFIG[type];
  return {
    ...state,
    type,
    role: roleForType(type, state.upn),
    permissions: { money: cfg.money, monthly: cfg.monthly },
    defaultView: cfg.defaultView,
    installRegion: cfg.installRegion,
  };
}
