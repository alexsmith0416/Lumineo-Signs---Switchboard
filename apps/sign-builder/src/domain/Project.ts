// Project — a named bundle of SignSpecs. Brought over from the Sign Builder
// Pro Preview model so users can group multiple signs under one project
// (storefront + monument + parking signs for one customer install). Signs
// still live in their own table; the Project just owns a name + metadata.

import type { SignSpec } from "./SignSpec";

export type Project = {
  id?: string;
  name: string;
  customerName: string;
  notes: string;
  createdAt: string;     // ISO date
  // Aggregate fields computed from associated signs — not persisted.
};

export type ProjectWithSigns = Project & {
  signs: SignSpec[];
  /** Total units across the project (sum of sign.quantity). */
  totalUnits: number;
};

export function emptyProject(): Project {
  return {
    name: "",
    customerName: "",
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

export function bundleSigns(project: Project, signs: SignSpec[]): ProjectWithSigns {
  return {
    ...project,
    signs,
    totalUnits: signs.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
  };
}
