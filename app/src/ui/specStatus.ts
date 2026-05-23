// Shared mapping from a SignSpec status to a Pill tone, so the Dashboard,
// Builder sidebar, and Gallery all colour the same status the same way.

import type { SignSpecStatus } from "../domain/SignSpec";
import type { PillTone } from "./Pill";

export function statusTone(status: SignSpecStatus): PillTone {
  switch (status) {
    case "Approved":  return "green";
    case "Built":     return "navy";
    case "Submitted": return "amber";
    case "Draft":
    default:          return "muted";
  }
}
