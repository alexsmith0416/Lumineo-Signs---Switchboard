// Purchase Order card: the warehouse's Vendor Status (next to BC's Status) and
// a Receiving part under the lines listing each delivery received against the
// PO in the Switchboard app. Both read-only — set in the app.
pageextension 58420 "LUM Purchase Order" extends "Purchase Order"
{
    layout
    {
        addafter(Status)
        {
            field("LUM Vendor Status"; Rec."LUM Vendor Status")
            {
                ApplicationArea = All;
                ToolTip = 'The warehouse''s status for this PO (Ordered, Shipping, Partially Received, Received…), set in the Switchboard app. Receiving there never posts a BC receipt.';
            }
        }
        addafter(PurchLines)
        {
            part(LUMReceiving; "LUM PO Deliveries Part")
            {
                ApplicationArea = All;
                Caption = 'Receiving (Switchboard)';
                SubPageLink = "PO No." = field("No.");
            }
        }
    }
}
