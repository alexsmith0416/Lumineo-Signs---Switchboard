// Read-only API: the purchase orders written to each job, one row per (job, PO).
// A PO is tied to a job by "Job No." (caption "Project No.") on its lines; lines
// carry no vendor name, so the header supplies it. Grouping by the
// non-aggregated columns collapses a PO's many lines into one row.
//
// This covers OPEN orders (Purchase Line). Once a PO is fully received and
// invoiced BC deletes it and keeps only the archive — see "Lumineo Job PO
// Archive" (58402). The sync flow reads both and keeps one row per (job, PO),
// preferring the open one.
//
// An API query (not a web-service query): BC exposes it by itself, no Web
// Services row. v1.0.0.6/7 published these as QueryType = Normal web services
// and BC never put them in the OData service list (404 for every login).
//   GET .../api/lumineo/planning/v1.0/companies(<id>)/jobPurchaseOrders
//       ?$filter=jobNo eq 'J36110'
query 58401 "Lumineo Job POs"
{
    Caption = 'Lumineo Job POs';
    QueryType = API;
    APIPublisher = 'lumineo';
    APIGroup = 'planning';
    APIVersion = 'v1.0';
    EntityName = 'jobPurchaseOrder';
    EntitySetName = 'jobPurchaseOrders';
    DataAccessIntent = ReadOnly;

    elements
    {
        dataitem(PurchLine; "Purchase Line")
        {
            DataItemTableFilter = "Document Type" = const(Order), "Job No." = filter(<> '');

            column(jobNo; "Job No.") { }
            column(documentNo; "Document No.") { }
            column(lineCount) { Method = Count; }
            column(amount; Amount) { Method = Sum; }

            dataitem(PurchHeader; "Purchase Header")
            {
                DataItemLink = "Document Type" = PurchLine."Document Type", "No." = PurchLine."Document No.";
                SqlJoinType = InnerJoin;

                column(buyFromVendorNo; "Buy-from Vendor No.") { }
                column(buyFromVendorName; "Buy-from Vendor Name") { }
                column(orderDate; "Order Date") { }
                column(status; Status) { }
            }
        }
    }
}
