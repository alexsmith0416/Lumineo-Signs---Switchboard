// API over "LUM PO Delivery" for the BCPush_PoDeliveries flow (Dataverse → BC).
// Keyed by the app's delivery id (the Dataverse row id), so an edit or a
// removal in the app finds the same row here:
//   GET    .../api/lumineo/planning/v1.0/companies(<id>)/poDeliveries?$filter=id eq <guid>
//   POST   .../poDeliveries                    { id, poNo, jobNo, dateReceived, … }
//   PATCH  .../poDeliveries(<guid>)  If-Match: *
//   DELETE .../poDeliveries(<guid>)  If-Match: *
page 58423 "Lumineo PO Deliveries API"
{
    Caption = 'Lumineo PO Deliveries';
    PageType = API;
    APIPublisher = 'lumineo';
    APIGroup = 'planning';
    APIVersion = 'v1.0';
    EntityName = 'poDelivery';
    EntitySetName = 'poDeliveries';
    SourceTable = "LUM PO Delivery";
    ODataKeyFields = Id;
    DelayedInsert = true;

    layout
    {
        area(Content)
        {
            repeater(Rows)
            {
                field(id; Rec.Id) { }
                field(poNo; Rec."PO No.") { }
                field(jobNo; Rec."Job No.") { }
                field(dateReceived; Rec."Date Received") { }
                field(receivedAt; Rec."Received At") { }
                field(storageLocation; Rec."Storage Location") { }
                field(receivedBy; Rec."Received By") { }
                field(notes; Rec.Notes) { }
                field(final; Rec.Final) { }
            }
        }
    }
}
