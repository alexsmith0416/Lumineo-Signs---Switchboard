// Sub-app launch contract (docs/07-sub-apps.md). When Switchboard launches
// Sign Builder Pro it appends `?userEmail=...&role=...` so the child app
// knows who's driving without re-authenticating. We read those params once
// on mount and stash them in context.

import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export type LaunchContext = {
  userEmail: string;
  role: string;
};

export function useLaunchParams(): LaunchContext {
  const { search } = useLocation();
  return useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      userEmail: p.get("userEmail") ?? "",
      role: p.get("role") ?? "",
    };
  }, [search]);
}
