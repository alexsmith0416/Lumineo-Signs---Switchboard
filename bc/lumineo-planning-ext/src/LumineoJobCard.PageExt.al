// Job (Project) Card: a PO Receiving part under the tasks — each of the job's
// purchase orders with its Vendor Status, deliveries and where the material is
// stored, from the Switchboard app's Warehouse Management. Read-only.
pageextension 58421 "LUM Job Card" extends "Job Card"
{
    layout
    {
        addafter(JobTaskLines)
        {
            part(LUMPOReceiving; "LUM Job PO Receiving Part")
            {
                ApplicationArea = All;
                Caption = 'PO Receiving (Switchboard)';
                SubPageLink = "Job No." = field("No.");
            }
        }
    }
}
