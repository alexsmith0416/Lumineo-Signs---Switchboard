import type { WarehousePO } from "../services/po-receiving";

/** Synthetic job POs for dev (no real vendors in the repo). */
export const MOCK_POS: WarehousePO[] = [
  {
    jobNo: "J102301",
    poNo: "PO-10482",
    vendorNo: "V0001",
    vendorName: "Sample Metals Supply",
    orderDate: "2026-09-22",
    status: "Released",
  },
  {
    jobNo: "J102301",
    poNo: "PO-10488",
    vendorNo: "V0002",
    vendorName: "Example Acrylics Co.",
    orderDate: "2026-09-24",
    status: "Released",
  },
  {
    jobNo: "J102301",
    poNo: "PO-10391",
    vendorNo: "V0002",
    vendorName: "Example Acrylics Co.",
    orderDate: "2026-09-08",
    status: "Archived",
  },
  {
    jobNo: "J102345",
    poNo: "PO-10501",
    vendorNo: "V0003",
    vendorName: "Demo LED Wholesale",
    orderDate: "2026-09-29",
    status: "Released",
  },
  {
    jobNo: "J102501",
    poNo: "PO-10512",
    vendorNo: "V0004",
    vendorName: "Placeholder Vinyl Inc.",
    orderDate: "2026-10-01",
    status: "Open",
  },
  {
    jobNo: "J102501",
    poNo: "PO-10513",
    vendorNo: "V0001",
    vendorName: "Sample Metals Supply",
    orderDate: "2026-10-02",
    status: "Released",
  },
  {
    jobNo: "J103101",
    poNo: "PO-10530",
    vendorNo: "V0005",
    vendorName: "Test Fasteners LLC",
    orderDate: "2026-10-05",
    status: "Released",
  },
];
