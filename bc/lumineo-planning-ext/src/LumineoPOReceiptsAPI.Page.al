// API over "LUM PO Receipt" for the BCPush_PoReceipts flow (Dataverse → BC).
// Keyed by the PO number, so the flow can address a row without looking up
// its SystemId:
//   GET   .../api/lumineo/planning/v1.0/companies(<id>)/poReceipts?$filter=poNo eq 'PO-1234'
//   POST  .../poReceipts                       { poNo, jobNo, vendorStatus, statusBy, statusAt }
//   PATCH .../poReceipts('PO-1234')  If-Match: *
page 58422 "Lumineo PO Receipts API"
{
    Caption = 'Lumineo PO Receipts';
    PageType = API;
    APIPublisher = 'lumineo';
    APIGroup = 'planning';
    APIVersion = 'v1.0';
    EntityName = 'poReceipt';
    EntitySetName = 'poReceipts';
    SourceTable = "LUM PO Receipt";
    ODataKeyFields = "PO No.";
    DelayedInsert = true;

    layout
    {
        area(Content)
        {
            repeater(Rows)
            {
                field(poNo; Rec."PO No.") { }
                field(jobNo; Rec."Job No.") { }
                field(vendorStatus; Rec."Vendor Status") { }
                field(statusBy; Rec."Status By") { }
                field(statusAt; Rec."Status At") { }
            }
        }
    }
}
