// One row each time an employee ticks "Task complete" on a job punch — on
// Clock Out Job, or on Clock In Job when they move straight from one job to
// the next (the tick then applies to the job they are LEAVING). Read by the
// BCSync_TaskCompletions flow (API page 58411); the Project Scheduler app then
// completes that department on the job's stepper and moves its Current Status.
//
// Our own table rather than a field on Infotech's ICG Labor Entry: punches are
// posted and moved to history by Infotech's code, and nothing here touches
// their records or their posting.
table 58410 "LUM Task Completion"
{
    Caption = 'Task Completion';
    DataClassification = CustomerContent;
    // Every shop-floor user writes a row when they tick the box, and the flow's
    // app user reads them — no permission set has to be assigned for that.
    InherentPermissions = RIMD;
    InherentEntitlements = RIMD;

    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
            AutoIncrement = true;
        }
        field(2; "Resource No."; Code[20])
        {
            Caption = 'Resource No.';
            TableRelation = Resource."No.";
        }
        field(3; "Resource Name"; Text[100])
        {
            Caption = 'Resource Name';
        }
        field(4; "Job No."; Code[20])
        {
            Caption = 'Project No.';
            TableRelation = Job."No.";
        }
        field(5; "Job Task No."; Code[20])
        {
            Caption = 'Project Task No.';
        }
        field(6; "Completed At"; DateTime)
        {
            Caption = 'Completed At';
        }
        field(7; Source; Text[20])
        {
            Caption = 'Source';
        }
        field(8; "Completed By"; Code[50])
        {
            Caption = 'Completed By (User)';
        }
    }

    keys
    {
        key(PK; "Entry No.") { Clustered = true; }
        key(Job; "Job No.", "Job Task No.") { }
    }
}
