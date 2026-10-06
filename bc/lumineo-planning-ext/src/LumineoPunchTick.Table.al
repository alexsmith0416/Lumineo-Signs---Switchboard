// A "Task complete" tick on one OPEN punch, set on the Clock In / Clock Out
// Multiple Projects/Nestings pages (list part 58412). Held here until that
// punch closes — whichever page or process closes it — and then turned into a
// "LUM Task Completion" row (codeunit 58410) and deleted.
//
// Keyed by the punch's ICG Labor Entry line, so a crew member on several
// projects at once can tick each one separately. Our own table: Infotech's
// labor entries are never modified.
table 58411 "LUM Punch Tick"
{
    Caption = 'Punch Task Complete Tick';
    DataClassification = CustomerContent;
    // Every shop-floor user ticks rows; no permission set has to be assigned.
    InherentPermissions = RIMD;
    InherentEntitlements = RIMD;

    fields
    {
        field(1; "Labor Entry Line No."; Integer)
        {
            Caption = 'Labor Entry Line No.';
        }
        field(2; "Resource No."; Code[20])
        {
            Caption = 'Resource No.';
            TableRelation = Resource."No.";
        }
        field(3; "Job No."; Code[20])
        {
            Caption = 'Project No.';
        }
        field(4; "Job Task No."; Code[20])
        {
            Caption = 'Project Task No.';
        }
        field(5; "Ticked At"; DateTime)
        {
            Caption = 'Ticked At';
        }
    }

    keys
    {
        key(PK; "Labor Entry Line No.") { Clustered = true; }
        key(Resource; "Resource No.") { }
    }
}
