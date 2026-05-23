import { useState } from "react";
import { addDays } from "date-fns";
import { useShippingStore } from "../store/schedule-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";

export default function ShippingCalendar() {
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
