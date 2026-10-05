// Read-only API: ARCHIVED purchase orders per job, one row per (job, PO, header
// details). Companion to "Lumineo Job POs" (58401) — a PO that has been fully
// received and invoiced leaves Purchase Line and survives only here, so this is
// what keeps a job's older material orders visible.
//
// An order is archived once per version (each print / release / delete adds
// one), so Max(versionNo) is returned; if a later version changed the vendor
// or order date the PO can come back as more than one row — the sync flow keeps
// the row with the highest versionNo per (job, PO).
//
// An API query, like 58401 (no Web Services row):
//   GET .../api/lumineo/planning/v1.0/companies(<id>)/jobPurchaseOrderArchives
//       ?$filter=jobNo eq 'J36110'
query 58402 "Lumineo Job PO Archive"
{
    Caption = 'Lumineo Job PO Archive';
    QueryType = API;
    APIPublisher = 'lumineo';
    APIGroup = 'planning';
    APIVersion = 'v1.0';
    EntityName = 'jobPurchaseOrderArchive';
    EntitySetName = 'jobPurchaseOrderArchives';
    DataAccessIntent = ReadOnly;

    elements
    {
        dataitem(PurchLineArch; "Purchase Line Archive")
        {
            DataItemTableFilter = "Document Type" = const(Order), "Job No." = filter(<> '');

            column(jobNo; "Job No.") { }
            column(documentNo; "Document No.") { }
            column(versionNo; "Version No.") { Method = Max; }

            dataitem(PurchHeaderArch; "Purchase Header Archive")
            {
                DataItemLink = "Document Type" = PurchLineArch."Document Type",
                               "No." = PurchLineArch."Document No.",
                               "Doc. No. Occurrence" = PurchLineArch."Doc. No. Occurrence",
                               "Version No." = PurchLineArch."Version No.";
                SqlJoinType = InnerJoin;

                column(buyFromVendorNo; "Buy-from Vendor No.") { }
                column(buyFromVendorName; "Buy-from Vendor Name") { }
                column(orderDate; "Order Date") { }
            }
        }
    }
}
