// Warehouse Management: one row per delivery received against a purchase order
// in the Switchboard app — date, the site it came in at (Received At) and the
// storage spot there, who, notes, and whether it
// was the last one (the PO is then Received). A MIRROR of Dataverse
// crfdf_podelivery, keyed by the app's delivery id, written only by the
// BCPush_PoDeliveries flow through API page 58423 (a delivery removed in the
// app is deleted here too). Shown on the Purchase Order card and the Job Card.
table 58421 "LUM PO Delivery"
{
    Caption = 'PO Delivery';
    DataClassification = CustomerContent;
    InherentPermissions = RIMD;
    InherentEntitlements = RIMD;
    LookupPageId = "LUM PO Deliveries Part";
    DrillDownPageId = "LUM PO Deliveries Part";

    fields
    {
        field(1; Id; Guid)
        {
            Caption = 'Id';
        }
        field(2; "PO No."; Code[20])
        {
            Caption = 'PO No.';
        }
        field(3; "Job No."; Code[20])
        {
            Caption = 'Project No.';
        }
        field(4; "Date Received"; Date)
        {
            Caption = 'Date Received';
        }
        field(5; "Storage Location"; Text[100])
        {
            Caption = 'Storage Location';
        }
        field(6; "Received By"; Text[100])
        {
            Caption = 'Received By';
        }
        field(7; Notes; Text[250])
        {
            Caption = 'Notes';
        }
        field(8; Final; Boolean)
        {
            Caption = 'Last Delivery';
        }
        field(9; "Received At"; Text[50])
        {
            Caption = 'Received At';
        }
        field(10; "Vendor Status"; Text[30])
        {
            Caption = 'Vendor Status';
            FieldClass = FlowField;
            CalcFormula = lookup("LUM PO Receipt"."Vendor Status" where("PO No." = field("PO No.")));
            Editable = false;
        }
    }

    keys
    {
        key(PK; Id) { Clustered = true; }
        key(PO; "PO No.", "Date Received") { }
        key(Job; "Job No.", "Date Received") { }
    }
}
