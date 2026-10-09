// Read-only list of a job's purchase orders as the warehouse sees them in the
// Switchboard app: Vendor Status, deliveries, last received and where the
// material is stored. A part on the Job Card (linked by Job No.). Click
// Deliveries to see each delivery.
page 58425 "LUM Job PO Receiving Part"
{
    Caption = 'PO Receiving (Switchboard)';
    PageType = ListPart;
    SourceTable = "LUM PO Receipt";
    SourceTableView = sorting("Job No.");
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
                    ToolTip = 'The purchase order.';

                    trigger OnDrillDown()
                    var
                        PurchHeader: Record "Purchase Header";
                    begin
                        if PurchHeader.Get(PurchHeader."Document Type"::Order, Rec."PO No.") then
                            Page.Run(Page::"Purchase Order", PurchHeader);
                    end;
                }
                field("Vendor Status"; Rec."Vendor Status")
                {
                    ApplicationArea = All;
                    ToolTip = 'Ordered, Shipping, Partially Received, Received, Delayed… — set in the Switchboard app.';
                    StyleExpr = StatusStyle;
                }
                field(Deliveries; Rec.Deliveries)
                {
                    ApplicationArea = All;
                    ToolTip = 'How many deliveries have been received. Click to see them.';
                }
                field("Last Received"; Rec."Last Received")
                {
                    ApplicationArea = All;
                    ToolTip = 'The most recent delivery.';
                }
                field(StoredAt; StoredAt)
                {
                    ApplicationArea = All;
                    Caption = 'Stored At';
                    ToolTip = 'Every site and storage spot the PO was received to (Hutchinson · Warehouse - Floor), newest first.';
                }
                field("Status By"; Rec."Status By")
                {
                    ApplicationArea = All;
                    ToolTip = 'Who last set the Vendor Status.';
                    Visible = false;
                }
            }
        }
    }

    var
        StoredAt: Text;
        StatusStyle: Text;

    local procedure PlaceOf(Delivery: Record "LUM PO Delivery"): Text
    begin
        // "Hutchinson · Warehouse - Floor", or whichever half is known — like the app.
        if (Delivery."Received At" <> '') and (Delivery."Storage Location" <> '') then
            exit(Delivery."Received At" + ' · ' + Delivery."Storage Location");
        if Delivery."Received At" <> '' then
            exit(Delivery."Received At");
        exit(Delivery."Storage Location");
    end;

    trigger OnAfterGetRecord()
    var
        Delivery: Record "LUM PO Delivery";
        Place: Text;
    begin
        // Newest first, no repeats — like the app's "Stored at".
        StoredAt := '';
        Delivery.SetCurrentKey("PO No.", "Date Received");
        Delivery.Ascending(false);
        Delivery.SetRange("PO No.", Rec."PO No.");
        if Delivery.FindSet() then
            repeat
                Place := PlaceOf(Delivery);
                if (Place <> '') and (StrPos(', ' + StoredAt + ',', ', ' + Place + ',') = 0) then
                    if StoredAt = '' then
                        StoredAt := Place
                    else
                        StoredAt += ', ' + Place;
            until Delivery.Next() = 0;

        case LowerCase(Rec."Vendor Status") of
            'received':
                StatusStyle := 'Favorable';
            'partially received':
                StatusStyle := 'Ambiguous';
            'delayed', 'on hold':
                StatusStyle := 'Unfavorable';
            else
                StatusStyle := 'Standard';
        end;
    end;
}
