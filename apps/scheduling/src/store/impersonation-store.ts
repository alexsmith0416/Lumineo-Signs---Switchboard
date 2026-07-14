import { create } from "zustand";
import type { EmployeeGroup, UserType } from "../services/current-user";

/**
 * Admin "view as user" (impersonation) — lets a real admin preview the app
 * exactly as another user sees it, to verify per-role/per-person visibility.
 *
 * This is a client-side VISIBILITY preview: it changes what the UI shows (nav,
 * $ / Monthly, landing screen, My Schedule identity), NOT the real Dataverse
 * access — the signed-in admin's own permissions still back every request.
 * Held in memory only, so a full reload returns to the real admin.
 */
export interface Impersonation {
  /** The user type being previewed (drives permissions / nav / landing). */
  type: UserType;
  /** Display name of the impersonated person. */
  name: string;
  /** Floor person: their roster employee id + group (drives My Schedule). */
  employeeId?: string;
  group?: EmployeeGroup;
  /** Sales / PM person: their salesperson code. */
  code?: string;
}

interface ImpersonationState {
  active: Impersonation | null;
  setActive: (imp: Impersonation) => void;
  clear: () => void;
}

export const useImpersonationStore = create<ImpersonationState>((set) => ({
  active: null,
  setActive: (imp) => set({ active: imp }),
  clear: () => set({ active: null }),
}));
