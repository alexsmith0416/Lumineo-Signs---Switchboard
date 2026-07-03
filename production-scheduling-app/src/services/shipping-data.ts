// Shipping schedule data source — live reads/writes against
// crfdf_shippingscheduleline through the reader seam.

import { createLiveScheduleSource } from "./schedule-source-factory";

export const shippingDataSource = createLiveScheduleSource({
  kind: "shipping",
  table: "crfdf_shippingscheduleline",
});
