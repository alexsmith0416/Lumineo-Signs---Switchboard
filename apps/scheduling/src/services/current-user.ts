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

/**
 * Classify a signed-in UPN/email: shared floor login, Sales/PM person, or
 * admin/ops. Sales/PM people sign in with <code>@lumineosigns.com — the email
 * local-part IS their BC salesperson code (ccarson@ → CCARSON).
 */
export function resolveRole(upn: string | undefined): Role {
  const email = upn?.trim().toLowerCase();
  const group = email ? SHARED_FLOOR_ACCOUNTS[email] : undefined;
  if (group) return { kind: "floor", group };
  const person = personByCode(email?.split("@")[0]);
  if (person?.type === "sales") return { kind: "sales", code: person.code };
  if (person?.type === "pm") return { kind: "pm", code: person.code };
  return { kind: "admin" };
}

export interface CurrentUser {
  loading: boolean;
  fullName?: string;
  /** userPrincipalName (email) of the signed-in Microsoft account. */
  upn?: string;
  role: Role;
}

/**
 * The signed-in Microsoft user, read from the Power Apps Code App context.
 * In dev/mock mode there's no host context, so we return a stand-in admin user.
 */
export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<Omit<CurrentUser, "role">>({ loading: true });
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
  return { ...state, role: resolveRole(state.upn) };
}
