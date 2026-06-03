import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Department, Employee } from "../engine/types";

interface VisibilityMenuProps {
  departments: Department[];
  employees: Employee[];
  hiddenDeptIds: Set<string>;
  hiddenEmployeeIds: Set<string>;
  onToggleDept: (id: string) => void;
  onToggleEmployee: (id: string) => void;
  onShowAll: () => void;
  resourceLabel: string;
  departmentLabel: string;
}

export default function VisibilityMenu({
  departments,
  employees,
  hiddenDeptIds,
  hiddenEmployeeIds,
  onToggleDept,
  onToggleEmployee,
  onShowAll,
  resourceLabel,
  departmentLabel,
}: VisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hiddenCount = hiddenDeptIds.size + hiddenEmployeeIds.size;

  // Group employees by department for the menu
  const byDept = new Map<string, Employee[]>();
  for (const emp of employees) {
    const list = byDept.get(emp.departmentId) ?? [];
    list.push(emp);
    byDept.set(emp.departmentId, list);
  }
  const orderedDepts = [...departments].sort((a, b) => a.flowOrder - b.flowOrder);

  return (
    <>
      <button
        ref={btnRef}
        className="visibility-menu__trigger"
        title={`Show / hide ${resourceLabel.toLowerCase()}s and ${departmentLabel.toLowerCase()}s`}
        onClick={() => {
          setAnchorRect(btnRef.current?.getBoundingClientRect() ?? null);
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        👁 {hiddenCount > 0 ? `${hiddenCount} hidden` : "Show all"}
      </button>

      {open && anchorRect &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 90 }}
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Visibility settings"
              style={{
                position: "fixed",
                top: anchorRect.bottom + 6,
                right: Math.max(8, window.innerWidth - anchorRect.right),
                width: 320,
                maxHeight: "70vh",
                background: "#fff",
                borderRadius: 6,
                boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                border: "1px solid var(--border)",
                zIndex: 91,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-secondary)",
                }}
              >
                <strong style={{ fontSize: 12 }}>Show / hide</strong>
                <button
                  type="button"
                  onClick={onShowAll}
                  disabled={hiddenCount === 0}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: hiddenCount === 0 ? "var(--text-tertiary)" : "var(--lumineo-navy)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: hiddenCount === 0 ? "default" : "pointer",
                  }}
                >
                  Show all
                </button>
              </div>
              <div style={{ overflowY: "auto", padding: 6 }}>
                {orderedDepts.map((dept) => {
                  const isDeptHidden = hiddenDeptIds.has(dept.id);
                  const emps = byDept.get(dept.id) ?? [];
                  return (
                    <div key={dept.id} style={{ marginBottom: 6 }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          background: dept.color,
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!isDeptHidden}
                          onChange={() => onToggleDept(dept.id)}
                        />
                        <span>{dept.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.7 }}>
                          {emps.length}
                        </span>
                      </label>
                      {!isDeptHidden && emps.length > 0 && (
                        <div style={{ marginTop: 2 }}>
                          {emps.map((emp) => (
                            <label
                              key={emp.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 10px 4px 26px",
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!hiddenEmployeeIds.has(emp.id)}
                                onChange={() => onToggleEmployee(emp.id)}
                              />
                              <span>{emp.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
