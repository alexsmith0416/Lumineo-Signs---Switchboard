// Read-only list of the deliveries received against a PO in the Switchboard
// app. A part on the Purchase Order card (linked by PO No.); also opens from
// the Job Card's PO Receiving part (Deliveries drill-down).
page 58424 "LUM PO Deliveries Part"
{
    Caption = 'Receiving (Switchboard)';
    PageType = ListPart;
    SourceTable = "LUM PO Delivery";
    SourceTableView = sorting("PO No.", "Date Received") order(descending);
    Editable = false;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;

    layout
    {
        area(Content)
        {
            repeater(Rows)
            {
                field("PO No."; Rec."PO No.")
                {
                    ApplicationArea = All;
                    ToolTip = 'The purchase order the delivery was received against.';
                }
                field("Date Received"; Rec."Date Received")
                {
                    ApplicationArea = All;
                    ToolTip = 'When the delivery arrived.';
                }
                field("Received At"; Rec."Received At")
                {
                    ApplicationArea = All;
                    ToolTip = 'The site the delivery came in at (Hutchinson, Olathe…).';
                }
                field("Storage Location"; Rec."Storage Location")
                {
                    ApplicationArea = All;
                    ToolTip = 'Where the material was put away at that site.';
                }
                field(Final; Rec.Final)
                {
                    ApplicationArea = All;
                    ToolTip = 'Everything on the PO is here (the PO is Received). Unticked = a partial delivery.';
                }
                field("Received By"; Rec."Received By")
                {
                    ApplicationArea = All;
                    ToolTip = 'Who received it in the Switchboard app.';
                }
                field(Notes; Rec.Notes)
                {
                    ApplicationArea = All;
                    ToolTip = 'Damage, short items, what is still coming.';
                }
            }
        }
    }
}
