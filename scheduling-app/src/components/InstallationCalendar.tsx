import { useInstallationStore } from "../store/schedule-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";

export default function InstallationCalendar() {
  return (
    <CalendarView
      useStore={useInstallationStore}
      kindMeta={KIND_META.installation}
    />
  );
}
