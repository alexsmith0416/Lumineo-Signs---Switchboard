import { useCallback, useEffect, useState } from "react";
import type { EmployeeGroup } from "../services/current-user";

export interface MyScheduleSelection {
  group: EmployeeGroup;
  employeeId: string;
  /** Cached name for the greeting before the roster loads. */
  name?: string;
}

const KEY = "lumineo.myschedule.selection";

function read(): MyScheduleSelection | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyScheduleSelection) : null;
  } catch {
    return null;
  }
}

/**
 * The employee this device's "My Schedule" is set to — persisted in
 * localStorage so a shared floor tablet remembers the last person. Returns the
 * current selection plus setters to pick or clear it.
 */
export function useMyScheduleSelection(): {
  selection: MyScheduleSelection | null;
  select: (sel: MyScheduleSelection) => void;
  clear: () => void;
} {
  const [selection, setSelection] = useState<MyScheduleSelection | null>(read);

  // Reflect changes made in other tabs on the same device.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSelection(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const select = useCallback((sel: MyScheduleSelection) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(sel));
    } catch {
      /* ignore quota / disabled storage */
    }
    setSelection(sel);
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSelection(null);
  }, []);

  return { selection, select, clear };
}
