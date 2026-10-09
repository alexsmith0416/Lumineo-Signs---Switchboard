// The PO's Vendor Status from the Switchboard app's receiving ("LUM PO Receipt"),
// for the Purchase Order card. A FlowField — nothing is stored on BC's table.
tableextension 58420 "LUM Purchase Header" extends "Purchase Header"
{
    fields
    {
        field(58420; "LUM Vendor Status"; Text[30])
        {
            Caption = 'Vendor Status (Switchboard)';
            FieldClass = FlowField;
            CalcFormula = lookup("LUM PO Receipt"."Vendor Status" where("PO No." = field("No.")));
            Editable = false;
        }
    }
}
