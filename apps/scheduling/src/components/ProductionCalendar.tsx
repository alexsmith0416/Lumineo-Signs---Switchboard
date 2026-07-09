import { useState } from "react";
import { addDays } from "date-fns";
import { useScheduleStore } from "../store/schedule-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";
import VisibilityMenu from "./VisibilityMenu";

interface ProductionCalendarProps {
  readOnly?: boolean;
  bannerSlot?: React.ReactNode;
  onNavigate?: (view: string) => void;
}

export default function ProductionCalendar({ readOnly = false, bannerSlot, onNavigate }: ProductionCalendarProps) {
  const weekStart = useScheduleStore((s) => s.weekStart);
  const employees = useScheduleStore((s) => s.employees);
  const departments = useScheduleStore((s) => s.departments);
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);
  const [hiddenDeptIds, setHiddenDeptIds] = useState<Set<string>>(new Set());
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());

  return (
    <>
      <CalendarView
        useStore={useScheduleStore}
        kindMeta={KIND_META.production}
        readOnly={readOnly}
        bannerSlot={bannerSlot}
        onNavigate={onNavigate}
        supportsScenarioSandbox={true}
        enableResourceAdmin={!readOnly}
        hiddenDeptIds={hiddenDeptIds}
        hiddenEmployeeIds={hiddenEmployeeIds}
        toolbarExtras={
          <VisibilityMenu
            departments={[...departments.values()]}
            employees={[...employees.values()]}
            hiddenDeptIds={hiddenDeptIds}
            hiddenEmployeeIds={hiddenEmployeeIds}
            onToggleDept={(id) =>
              setHiddenDeptIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onToggleEmployee={(id) =>
              setHiddenEmployeeIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onShowAll={() => {
              setHiddenDeptIds(new Set());
              setHiddenEmployeeIds(new Set());
            }}
            resourceLabel="Employee"
            departmentLabel="Department"
          />
        }
        addAction={
          <button
            className="btn-add-job"
            onClick={() =>
              setAddJobContext({ start: addDays(weekStart, 0), employeeId: undefined })
            }
          >
            + Add Job
          </button>
        }
        onEmptyCellClick={({ start, employeeId }) =>
          setAddJobContext({ start, employeeId })
        }
      />
      {addJobContext && (
        <AddJobPanel
          initialStart={addJobContext.start}
          initialEmployeeId={addJobContext.employeeId}
          onClose={() => setAddJobContext(null)}
        />
      )}
    </>
  );
}
