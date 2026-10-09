// Warehouse Management (Switchboard app, Oct 2026): one row per purchase order
// the warehouse has touched — its Vendor Status (Ordered, Shipping, Partially
// Received, Received, Delayed…), set in the app by Admin / Ops or by a
// delivery. A MIRROR of Dataverse crfdf_poreceipt, written only by the
// BCPush_PoReceipts flow through API page 58422; shown on the Purchase Order
// card (Vendor Status) and the Job Card (PO Receiving part).
//
// Receiving here never posts a BC receipt — whoever wrote the PO still does.
table 58420 "LUM PO Receipt"
{
    Caption = 'PO Receiving';
    DataClassification = CustomerContent;
    // The flow's app user writes it and anyone who opens a PO or job reads it —
    // no permission set has to be assigned for that (as "LUM Task Completion").
    InherentPermissions = RIMD;
    InherentEntitlements = RIMD;
    LookupPageId = "LUM Job PO Receiving Part";
    DrillDownPageId = "LUM Job PO Receiving Part";

    fields
    {
        field(1; "PO No."; Code[20])
        {
            Caption = 'PO No.';
        }
        field(2; "Job No."; Code[20])
        {
            Caption = 'Project No.';
        }
        field(3; "Vendor Status"; Text[30])
        {
            Caption = 'Vendor Status';
        }
        field(4; "Status By"; Text[100])
        {
            Caption = 'Status Set By';
        }
        field(5; "Status At"; DateTime)
        {
            Caption = 'Status Set At';
        }
        field(10; Deliveries; Integer)
        {
            Caption = 'Deliveries';
            FieldClass = FlowField;
            CalcFormula = count("LUM PO Delivery" where("PO No." = field("PO No.")));
            Editable = false;
        }
        field(11; "Last Received"; Date)
        {
            Caption = 'Last Received';
            FieldClass = FlowField;
            CalcFormula = max("LUM PO Delivery"."Date Received" where("PO No." = field("PO No.")));
            Editable = false;
        }
    }

    keys
    {
        key(PK; "PO No.") { Clustered = true; }
        key(Job; "Job No.") { }
    }
}
