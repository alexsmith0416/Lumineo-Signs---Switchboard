import { useEffect, useMemo, useState } from "react";
import type { Employee } from "../engine/types";
import {
  TYPE_CONFIG,
  isAdminLevel,
  useCurrentUser,
  type EmployeeGroup,
  type UserType,
} from "../services/current-user";
import {
  useScheduleStore,
  useInstallationStoreWK,
  useInstallationStoreNEK,
} from "../store/schedule-store";
import { PROJECT_MANAGERS, SALESPEOPLE } from "../services/sales-pm";
import {
  useImpersonationStore,
  type Impersonation,
} from "../store/impersonation-store";

interface PickPerson {
  key: string;
  name: string;
  imp: Impersonation;
}
interface PickGroup {
  type: UserType;
  label: string;
  people: PickPerson[];
}

function initials(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Topbar user chip + admin "View as user" picker. Real admins get a dropdown
 * of user TYPES; expanding a type reveals its people (Production → Chris Owen).
 * Picking a person previews the app as them (see impersonation-store). Non-admins
 * just see their own chip.
 */
export default function ViewAsMenu() {
  const { fullName, type, realType, isImpersonating, viewingAsName } = useCurrentUser();
  const setActive = useImpersonationStore((s) => s.setActive);
  const clear = useImpersonationStore((s) => s.clear);
  const canImpersonate = isAdminLevel(realType);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<UserType | null>(null);

  // Floor rosters (people come from each store's employee map).
  const prod = useScheduleStore((s) => s.employees);
  const wk = useInstallationStoreWK((s) => s.employees);
  const nek = useInstallationStoreNEK((s) => s.employees);
  const loadProd = useScheduleStore((s) => s.loadWeek);
  const loadWk = useInstallationStoreWK((s) => s.loadWeek);
  const loadNek = useInstallationStoreNEK((s) => s.loadWeek);

  // Make sure the rosters are loaded once the menu is opened.
  useEffect(() => {
    if (!open) return;
    if (prod.size === 0) void loadProd();
    if (wk.size === 0) void loadWk();
    if (nek.size === 0) void loadNek();
  }, [open, prod.size, wk.size, nek.size, loadProd, loadWk, loadNek]);

  const groups = useMemo<PickGroup[]>(() => {
    const floor = (
      g: EmployeeGroup,
      t: UserType,
      emps: Map<string, Employee>,
    ): PickPerson[] =>
      [...emps.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({
          key: `${g}:${e.id}`,
          name: e.name,
          imp: { type: t, name: e.name, employeeId: e.id, group: g },
        }));

    // Office roles have no employee roster — offer a single "role preview" that
    // shows the app exactly as that type sees it.
    const rolePreview = (t: UserType): PickPerson[] => [
      {
        key: `role:${t}`,
        name: `Preview as ${TYPE_CONFIG[t].label}`,
        imp: { type: t, name: `${TYPE_CONFIG[t].label} (preview)` },
      },
    ];

    return [
      { type: "admin", label: TYPE_CONFIG.admin.label, people: rolePreview("admin") },
      { type: "developer", label: TYPE_CONFIG.developer.label, people: rolePreview("developer") },
      { type: "ops", label: TYPE_CONFIG.ops.label, people: rolePreview("ops") },
      { type: "production", label: TYPE_CONFIG.production.label, people: floor("production", "production", prod) },
      { type: "install-wk", label: TYPE_CONFIG["install-wk"].label, people: floor("install-wk", "install-wk", wk) },
      { type: "install-nek", label: TYPE_CONFIG["install-nek"].label, people: floor("install-nek", "install-nek", nek) },
      {
        type: "sales",
        label: TYPE_CONFIG.sales.label,
        people: SALESPEOPLE.map((p) => ({
          key: `sales:${p.code}`,
          name: p.name,
          imp: { type: "sales", name: p.name, code: p.code },
        })),
      },
      {
        type: "pm",
        label: TYPE_CONFIG.pm.label,
        people: PROJECT_MANAGERS.map((p) => ({
          key: `pm:${p.code}`,
          name: p.name,
          imp: { type: "pm", name: p.name, code: p.code },
        })),
      },
    ];
  }, [prod, wk, nek]);

  const displayName = isImpersonating ? viewingAsName : fullName;
  const roleLabel = TYPE_CONFIG[type].label;

  const pick = (imp: Impersonation) => {
    setActive(imp);
    setOpen(false);
    setExpanded(null);
  };

  return (
    <div className="viewas">
      <button
        type="button"
        className={"viewas__chip" + (isImpersonating ? " viewas__chip--impersonating" : "")}
        onClick={() => (canImpersonate ? setOpen((v) => !v) : undefined)}
        title={canImpersonate ? "View as another user" : undefined}
        aria-haspopup={canImpersonate || undefined}
        aria-expanded={open || undefined}
      >
        <span className="viewas__avatar">{initials(displayName)}</span>
        <span className="viewas__info">
          <span className="viewas__name">{displayName ?? "User"}</span>
          <span className="viewas__role">
            {isImpersonating ? `Viewing as · ${roleLabel}` : roleLabel}
          </span>
        </span>
        {canImpersonate && <span className="viewas__caret">▾</span>}
      </button>

      {open && canImpersonate && (
        <>
          <div className="viewas__backdrop" onClick={() => setOpen(false)} />
          <div className="viewas__menu" role="menu">
            {isImpersonating && (
              <button
                type="button"
                className="viewas__exit"
                onClick={() => {
                  clear();
                  setOpen(false);
                  setExpanded(null);
                }}
              >
                ← Exit — back to {fullName ?? "Admin"}
              </button>
            )}
            <div className="viewas__head">View as user</div>
            {groups.map((g) => {
              const isOpen = expanded === g.type;
              return (
                <div key={g.type} className="viewas__group">
                  <button
                    type="button"
                    className="viewas__type"
                    onClick={() => setExpanded(isOpen ? null : g.type)}
                    aria-expanded={isOpen}
                  >
                    <span className="viewas__type-caret">{isOpen ? "▾" : "▸"}</span>
                    {g.label}
                    <span className="viewas__count">{g.people.length}</span>
                  </button>
                  {isOpen && (
                    <div className="viewas__people">
                      {g.people.length === 0 ? (
                        <div className="viewas__empty">No one loaded yet…</div>
                      ) : (
                        g.people.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            className="viewas__person"
                            onClick={() => pick(p.imp)}
                          >
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
