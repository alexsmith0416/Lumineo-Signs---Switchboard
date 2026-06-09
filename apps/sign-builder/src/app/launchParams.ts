// Sub-app launch contract (docs/07-sub-apps.md). When Switchboard launches
// Sign Builder Pro it appends `?userEmail=...&role=...` so the child app
// knows who's driving without re-authenticating. We read those params once
// on mount and stash them in context.

import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export type LaunchContext = {
  userEmail: string;
  role: string;
  /** Spec to preload on Builder mount — typically passed from Project Scheduler. */
  specId: string;
  /** Project Scheduler Job UUID. When present, a new spec auto-links to
      this Job (and the Gallery + Projects screens can filter by it).
      See docs/07-sub-apps.md, Sign Builder Pro section. */
  jobId: string;
  /** Sales Hub Opportunity UUID. When present, a new spec auto-links to
      this Opportunity so the eventual SignSpec → Quote conversion knows
      where it came from. */
  opportunityId: string;
};

const OPS_ROLE = "Operations";

export function isOps(launch: { role: string }): boolean {
  return launch.role === OPS_ROLE;
}

export function useLaunchParams(): LaunchContext {
  const { search } = useLocation();
  return useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      userEmail:     p.get("userEmail")     ?? "",
      role:          p.get("role")          ?? "",
      specId:        p.get("specId")        ?? "",
      jobId:         p.get("jobId")         ?? "",
      opportunityId: p.get("opportunityId") ?? "",
    };
  }, [search]);
}
