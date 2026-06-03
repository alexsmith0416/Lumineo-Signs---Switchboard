import {
  SHIPPING_DEPARTMENTS,
  SHIPPING_LINES,
  SHIPPING_OVERTIME,
  SHIPPING_TRUCKS,
  SHIPPING_WORK_HOURS,
} from "../data/mock-shipping";
import { createMockDataSource } from "./data-source";

// STUB: replace with real Dataverse `crfdf_shippingscheduleline` reads
// once M7 wiring lands.
export const shippingDataSource = createMockDataSource("shipping", {
  departments: SHIPPING_DEPARTMENTS,
  employees: SHIPPING_TRUCKS,
  schedule: SHIPPING_LINES,
  workHours: SHIPPING_WORK_HOURS,
  overtime: SHIPPING_OVERTIME,
});
