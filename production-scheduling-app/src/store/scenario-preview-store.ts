import type { ScheduleDataSource } from "../services/data-source";
import { createScheduleStore } from "./schedule-store";

// A no-op data source that satisfies the ScheduleDataSource interface so the
// preview store has the same shape as the live schedule stores. Writes are
// never expected — CalendarView is always rendered with readOnly=true when
// pointed at this store, and the live "Commit"/"Discard" actions on the
// scenario sandbox write through the scenario-store + production data source.
const noopDataSource: ScheduleDataSource = {
  kind: "production",
  async loadDepartments() {
    return [];
  },
  async loadEmployees() {
    return [];
  },
  async loadScheduleLines() {
    return [];
  },
  async loadWorkHours() {
    return [];
  },
  async loadOvertimeOverrides() {
    return [];
  },
  async updateScheduleLine(_id, changes) {
    // Returning the changes as a fake line satisfies the type without writing
    // anywhere. The preview is read-only at the UI level.
    return changes as never;
  },
  async createScheduleLine(line) {
    return line;
  },
  async deleteScheduleLine() {
    return;
  },
};

export const useScenarioPreviewStore = createScheduleStore(noopDataSource);

// CalendarView calls loadWeek on mount. For the preview store the state is
// hydrated externally from the scenario result, so swallow the load instead
// of letting it overwrite the hydrated data with empty noop-source values.
useScenarioPreviewStore.setState({
  loadWeek: async () => {
    /* no-op — hydrate via setState from ScenarioSandbox */
  },
});
