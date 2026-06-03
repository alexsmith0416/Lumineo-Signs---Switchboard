import { useState } from "react";
import { addDays } from "date-fns";
import { useShippingStore } from "../store/schedule-store";
import { useShippingScenarioStore } from "../store/scenario-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";
import VisibilityMenu from "./VisibilityMenu";
import AddCustomLocationDialog from "./AddCustomLocationDialog";

interface ShippingCalendarProps {
  onNavigate?: (view: string) => void;
}

export default function ShippingCalendar({ onNavigate }: ShippingCalendarProps = {}) {
  const weekStart = useShippingStore((s) => s.weekStart);
  const employees = useShippingStore((s) => s.employees);
  const departments = useShippingStore((s) => s.departments);
  const addDepartment = useShippingStore((s) => s.addDepartment);
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);
  const [hiddenDeptIds, setHiddenDeptIds] = useState<Set<string>>(new Set());
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());
  const [addLocationOpen, setAddLocationOpen] = useState(false);

  const maxFlow = [...departments.values()].reduce((m, d) => (d.flowOrder > m ? d.flowOrder : m), 0);

  return (
    <>
      <CalendarView
        useStore={useShippingStore}
        kindMeta={KIND_META.shipping}
        onNavigate={onNavigate}
        supportsScenarioSandbox={!!onNavigate}
        scenarioStore={useShippingScenarioStore}
        hiddenDeptIds={hiddenDeptIds}
        hiddenEmployeeIds={hiddenEmployeeIds}
        toolbarExtras={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="visibility-menu__trigger"
              onClick={() => setAddLocationOpen(true)}
              title="Add a custom shipping location"
            >
              + Location
            </button>
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
              resourceLabel="Truck"
              departmentLabel="Location"
            />
          </div>
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
          useStore={useShippingStore}
        />
      )}
      {addLocationOpen && (
        <AddCustomLocationDialog
          onClose={() => setAddLocationOpen(false)}
          onAdd={(dept) => addDepartment(dept)}
          nextFlowOrder={maxFlow + 1}
        />
      )}
    </>
  );
}
