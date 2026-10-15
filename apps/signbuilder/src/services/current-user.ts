/**
 * The signed-in user and what they may do — the same user types as
 * Switchboard, read from its App Users table (crfdf_appuser), so a role is set
 * once for both apps.
 *
 *   Sales                     → specs at the opportunity level
 *   PM / production / install → specs at job level (artists, estimators)
 *   Ops                       → + Approve
 *   Admin / Developer         → + Setup (questions, rules, sign types…)
 */
import { useEffect, useState } from "react";
import { LIVE } from "./repo";
import { listAll, odataLit } from "./dataverse-core";

export type UserType =
  | "admin"
  | "developer"
  | "ops"
  | "production"
  | "install-wk"
  | "install-nek"
  | "sales"
  | "pm"
  | "demo";

export interface Permissions {
  /** Create and edit specs. */
  editSpecs: boolean;
  /** Approve a spec (Ops). */
  approve: boolean;
  /** Change the setup: categories, sign types, questions, rules… */
  setup: boolean;
  /** Write descriptions to the BC project. */
  generateToProject: boolean;
}

export interface CurrentUser {
  loading: boolean;
  fullName: string;
  email: string;
  type: UserType;
  permissions: Permissions;
}

const PERMISSIONS: Record<UserType, Permissions> = {
  admin: { editSpecs: true, approve: true, setup: true, generateToProject: true },
  developer: { editSpecs: true, approve: true, setup: true, generateToProject: true },
  ops: { editSpecs: true, approve: true, setup: false, generateToProject: true },
  pm: { editSpecs: true, approve: false, setup: false, generateToProject: true },
  sales: { editSpecs: true, approve: false, setup: false, generateToProject: false },
  production: { editSpecs: true, approve: false, setup: false, generateToProject: false },
  "install-wk": { editSpecs: false, approve: false, setup: false, generateToProject: false },
  "install-nek": { editSpecs: false, approve: false, setup: false, generateToProject: false },
  demo: { editSpecs: true, approve: false, setup: false, generateToProject: false },
};

const isUserType = (v: string): v is UserType => Object.prototype.hasOwnProperty.call(PERMISSIONS, v);

export function permissionsFor(type: UserType): Permissions {
  return PERMISSIONS[type];
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    loading: true,
    fullName: "",
    email: "",
    type: "sales",
    permissions: PERMISSIONS.sales,
  });

  useEffect(() => {
    if (!LIVE) {
      setState({ loading: false, fullName: "Dev User", email: "dev@local", type: "admin", permissions: PERMISSIONS.admin });
      return;
    }
    let alive = true;
    void (async () => {
      let fullName = "";
      let email = "";
      try {
        const { getContext } = await import("@microsoft/power-apps/app");
        const ctx = await getContext();
        fullName = ctx.user.fullName ?? "";
        email = (ctx.user.userPrincipalName ?? "").trim().toLowerCase();
      } catch {
        /* no host context */
      }
      // Role from Switchboard's App Users table; unknown logins get Sales
      // (spec at the opportunity level, no setup).
      let type: UserType = "sales";
      try {
        if (email) {
          const rows = await listAll("crfdf_appusers", { select: "crfdf_email,crfdf_usertype", filter: `crfdf_email eq '${odataLit(email)}'` });
          const t = String(rows[0]?.crfdf_usertype ?? "").trim().toLowerCase();
          if (isUserType(t)) type = t;
        }
      } catch {
        /* keep the fallback */
      }
      if (alive) setState({ loading: false, fullName, email, type, permissions: PERMISSIONS[type] });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
