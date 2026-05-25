import { useState } from "react";
import { addDays } from "date-fns";
import { useShippingStore } from "../store/schedule-store";
import { useShippingScenarioStore } from "../store/scenario-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";

interface ShippingCalendarProps {
  onNavigate?: (view: string) => void;
}

export default function ShippingCalendar({ onNavigate }: ShippingCalendarProps = {}) {
  const weekStart = useShippingStore((s) => s.weekStart);
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);

  return (
    <>
      <CalendarView
        useStore={useShippingStore}
        kindMeta={KIND_META.shipping}
        onNavigate={onNavigate}
        supportsScenarioSandbox={!!onNavigate}
        scenarioStore={useShippingScenarioStore}
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
    </>
  );
}
