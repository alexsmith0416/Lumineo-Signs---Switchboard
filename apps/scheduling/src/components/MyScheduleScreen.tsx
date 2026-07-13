import { useEffect, useState } from "react";
import { useCurrentUser, type EmployeeGroup } from "../services/current-user";
import { ADMIN_TABS, FLOOR_GROUPS, GROUP_LABELS, GROUP_STORES } from "../services/employee-groups";
import { useMyScheduleSelection } from "../hooks/useMyScheduleSelection";
import MySchedule from "./MySchedule";

/** A clickable roster of one group's employees. */
function EmployeeList({
  group,
  onPick,
}: {
  group: EmployeeGroup;
  onPick: (employeeId: string, name: string) => void;
}) {
  const store = GROUP_STORES[group];
  const employees = store((s) => s.employees);
  const loadWeek = store((s) => s.loadWeek);

  useEffect(() => {
    if (employees.size === 0) void loadWeek();
  }, [employees.size, loadWeek]);

  const list = [...employees.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (list.length === 0) return <div className="loading">Loading roster…</div>;

  return (
    <div className="emp-picker__list">
      {list.map((e) => (
        <button key={e.id} type="button" className="emp-picker__item" onClick={() => onPick(e.id, e.name)}>
          <span>{e.name}</span>
          {e.truckNumber && <span className="emp-picker__truck">{e.truckNumber}</span>}
        </button>
      ))}
    </div>
  );
}

/** Admin / ops view: browse every roster's employees and open their schedule. */
function EmployeeSchedules() {
  const [tab, setTab] = useState<EmployeeGroup>("production");
  const [picked, setPicked] = useState<{ group: EmployeeGroup; employeeId: string } | null>(null);

  if (picked) {
    return (
      <MySchedule
        key={`${picked.group}:${picked.employeeId}`}
        group={picked.group}
        employeeId={picked.employeeId}
        lead={
          <button type="button" className="my-schedule__switch" onClick={() => setPicked(null)}>
            ← All employees
          </button>
        }
      />
    );
  }

  return (
    <div className="emp-browser">
      <div className="emp-browser__tabs" role="tablist" aria-label="Employee roster">
        {ADMIN_TABS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={tab === g}
            className={`emp-browser__tab${tab === g ? " emp-browser__tab--active" : ""}`}
            onClick={() => setTab(g)}
          >
            {GROUP_LABELS[g]}
          </button>
        ))}
      </div>
      <EmployeeList
        key={tab}
        group={tab}
        onPick={(employeeId) => setPicked({ group: tab, employeeId })}
      />
    </div>
  );
}

/**
 * "My Schedule" (floor logins) / "Employee Schedules" (admin & ops).
 * Floor logins pick their own name once per device and see their schedule;
 * admin/ops browse every roster and open any employee's schedule.
 */
export default function MyScheduleScreen() {
  const { loading, role } = useCurrentUser();
  const { selection, select, clear } = useMyScheduleSelection();

  if (loading) return <div className="loading">Loading…</div>;

  if (role.kind === "admin") return <EmployeeSchedules />;

  // Floor login — pick a name (once per device), then show that person's week.
  const groups = FLOOR_GROUPS[role.group];
  if (!selection) {
    return (
      <div className="emp-picker">
        <h3 className="emp-picker__title">Who's this? Pick your name</h3>
        {groups.map((g) => (
          <div key={g} className="emp-picker__section">
            {groups.length > 1 && <div className="emp-picker__group">{GROUP_LABELS[g]}</div>}
            <EmployeeList group={g} onPick={(employeeId, name) => select({ group: g, employeeId, name })} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <MySchedule
      key={`${selection.group}:${selection.employeeId}`}
      group={selection.group}
      employeeId={selection.employeeId}
      lead={
        <button type="button" className="my-schedule__switch" onClick={clear}>
          ← Not {selection.name ?? "you"}? Switch employee
        </button>
      }
    />
  );
}
