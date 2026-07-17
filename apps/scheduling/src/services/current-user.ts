import { useEffect, useState } from "react";
import { personByCode } from "./sales-pm";
import { useImpersonationStore } from "../store/impersonation-store";

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
  /** May see crew/truck logistics on install cards (the Crew/Truck toggle +
   *  crew badges). Admin/Ops only — basic users don't need this. */
  crew: boolean;
  /** May see the Monthly Gameplanning view. */
  monthly: boolean;
  /** May see + use the Scenario Sandbox (Admin/Ops only). */
  scenarios: boolean;
  /** May edit the schedules — drag/drop, add/edit/delete jobs, roster admin,
   *  shipping loads. When false the boards are view-only (Admin/Ops only). */
  editSchedule: boolean;
}

interface TypeConfig {
  label: string;
  /** Screen the app opens on for this type. */
  defaultView: AppView;
  money: boolean;
  /** Crew/truck logistics visibility (Admin/Ops only). */
  crew: boolean;
  monthly: boolean;
  /** Scenario Sandbox visibility. */
  scenarios: boolean;
  /** May edit schedules (vs. view-only). */
  editSchedule: boolean;
  /** For installers: which install region their board defaults to. */
  installRegion?: "WK" | "NEK";
}

export const TYPE_CONFIG: Record<UserType, TypeConfig> = {
  admin: { label: "Admin", defaultView: "production", money: true, crew: true, monthly: true, scenarios: true, editSchedule: true },
  ops: { label: "Ops", defaultView: "production", money: true, crew: true, monthly: true, scenarios: true, editSchedule: true },
  production: { label: "Production", defaultView: "production", money: false, crew: false, monthly: false, scenarios: false, editSchedule: false },
  "install-wk": { label: "WK Install", defaultView: "installation", money: false, crew: false, monthly: false, scenarios: false, editSchedule: false, installRegion: "WK" },
  "install-nek": { label: "NEK Install", defaultView: "installation", money: false, crew: false, monthly: false, scenarios: false, editSchedule: false, installRegion: "NEK" },
  sales: { label: "Sales", defaultView: "my-schedule", money: false, crew: false, monthly: false, scenarios: false, editSchedule: false },
  pm: { label: "Project Manager", defaultView: "my-schedule", money: false, crew: false, monthly: false, scenarios: false, editSchedule: false },
};

// Roster: login email (lower-case) → user type. Fill this from the provided list.
//   "asmith@lumineosigns.com": "admin",
//   "jdoe@lumineosigns.com": "install-nek",
export const USER_DIRECTORY: Record<string, UserType> = {
  "jontjes@lumineosigns.com": "admin", // Joe Ontjes
};

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

  // --- Impersonation ("view as user") ---------------------------------------
  /** The real signed-in user's type (unchanged by impersonation). Only real
   *  admins may impersonate. */
  realType: UserType;
  /** True while a real admin is previewing the app as another user. */
  isImpersonating: boolean;
  /** Display name of the person being previewed (when impersonating). */
  viewingAsName?: string;
  /** Impersonated floor person's My-Schedule identity (roster group + id). */
  impersonatedGroup?: EmployeeGroup;
  impersonatedEmployeeId?: string;
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
  const realType = resolveUserType(state.upn);
  // Only real admins may "view as" another user — a non-admin can never escalate.
  const canImpersonate = realType === "admin";
  const imp = useImpersonationStore((s) => s.active);
  const active = canImpersonate ? imp : null;

  const type = active ? active.type : realType;
  const cfg = TYPE_CONFIG[type];
  // Impersonated role: a floor/sales/pm person adopts that identity so their
  // My Schedule / Active Jobs resolve to the right person.
  const role: Role = active
    ? active.code
      ? { kind: active.type === "pm" ? "pm" : "sales", code: active.code }
      : roleForType(active.type, undefined)
    : roleForType(realType, state.upn);

  return {
    ...state,
    type,
    role,
    permissions: {
      money: cfg.money,
      crew: cfg.crew,
      monthly: cfg.monthly,
      scenarios: cfg.scenarios,
      editSchedule: cfg.editSchedule,
    },
    defaultView: cfg.defaultView,
    installRegion: cfg.installRegion,
    realType,
    isImpersonating: !!active,
    viewingAsName: active?.name,
    impersonatedGroup: active?.group,
    impersonatedEmployeeId: active?.employeeId,
  };
}
