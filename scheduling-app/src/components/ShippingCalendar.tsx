import { useShippingStore } from "../store/schedule-store";
import { KIND_META } from "../services/data-source";
import CalendarView from "./CalendarView";

export default function ShippingCalendar() {
  return (
    <CalendarView
      useStore={useShippingStore}
      kindMeta={KIND_META.shipping}
    />
  );
}
