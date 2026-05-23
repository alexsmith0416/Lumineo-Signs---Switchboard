import { useState } from "react";
import { addDays } from "date-fns";
import { useScheduleStore } from "../store/schedule-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";
import AddJobPanel from "./AddJobPanel";

interface ProductionCalendarProps {
  readOnly?: boolean;
  bannerSlot?: React.ReactNode;
  onNavigate?: (view: string) => void;
}

export default function ProductionCalendar({ readOnly = false, bannerSlot, onNavigate }: ProductionCalendarProps) {
  const weekStart = useScheduleStore((s) => s.weekStart);
  const [addJobContext, setAddJobContext] = useState<{
    start?: Date;
    employeeId?: string;
  } | null>(null);

  return (
    <>
      <CalendarView
        useStore={useScheduleStore}
        kindMeta={KIND_META.production}
        readOnly={readOnly}
        bannerSlot={bannerSlot}
        onNavigate={onNavigate}
        supportsScenarioSandbox={true}
        addAction={
          <button
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
