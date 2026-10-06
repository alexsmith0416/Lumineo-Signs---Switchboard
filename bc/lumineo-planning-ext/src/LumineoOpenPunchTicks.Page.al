// "Mark tasks complete" on the Clock In / Clock Out Multiple Projects/Nestings
// pages: the employee's open project punches, each with its own Task complete
// checkbox. A ticked punch is recorded as a completion when it closes.
//
// Infotech's own Open Project Punches part is read-only (Editable = false), so
// this is a separate part. The parent page calls SetResource as the employee
// is entered; with no employee it lists nothing.
page 58412 "LUM Open Punch Ticks"
{
    Caption = 'Mark tasks complete';
    PageType = ListPart;
    SourceTable = "ICG Labor Entry";
    SourceTableView = sorting("Line No.") order(descending)
                      where("Daily Punch" = const(false), "DateTime Out" = filter(''));
    InsertAllowed = false;
    DeleteAllowed = false;
    ModifyAllowed = true;
    LinksAllowed = false;

    layout
    {
        area(Content)
        {
            repeater(Punches)
            {
                field(LUMTaskComplete; TaskComplete)
                {
                    ApplicationArea = All;
                    Caption = 'Task complete';
                    ToolTip = 'Tick if you finished this project task. It is marked complete on the job when this punch closes (Clock Out, or clocking in to a new project).';

                    trigger OnValidate()
                    begin
                        SetTick(TaskComplete);
                    end;
                }
                field("Job No."; Rec."Job No.")
                {
                    ApplicationArea = All;
                    Caption = 'Project No.';
                    Editable = false;
                    ToolTip = 'The project this open punch is on.';
                }
                field("Job Task No."; Rec."Job Task No.")
                {
                    ApplicationArea = All;
                    Caption = 'Project Task No.';
                    Editable = false;
                    ToolTip = 'The project task this open punch is on.';
                }
                field(LUMTaskDescription; TaskDescription)
                {
                    ApplicationArea = All;
                    Caption = 'Task';
                    Editable = false;
                    ToolTip = 'The project task''s description.';
                }
                field("DateTime In"; Rec."DateTime In")
                {
                    ApplicationArea = All;
                    Editable = false;
                    ToolTip = 'When this punch started.';
                }
            }
        }
    }

    trigger OnOpenPage()
    begin
        if not Filtered then
            SetResource('');
    end;

    trigger OnAfterGetRecord()
    var
        Tick: Record "LUM Punch Tick";
        JobTask: Record "Job Task";
    begin
        TaskComplete := Tick.Get(Rec."Line No.");
        TaskDescription := '';
        if JobTask.Get(Rec."Job No.", Rec."Job Task No.") then
            TaskDescription := JobTask.Description;
    end;

    var
        TaskComplete: Boolean;
        TaskDescription: Text;
        Filtered: Boolean;

    /// The employee whose open punches to list ('' = none). Also clears ticks
    /// left on punches that no longer exist.
    procedure SetResource(ResourceNo: Code[20])
    begin
        Filtered := true;
        Rec.FilterGroup(2);
        if ResourceNo = '' then
            Rec.SetRange("Line No.", -1) // nothing
        else begin
            Rec.SetRange("Line No.");
            Rec.SetRange("Resource No.", ResourceNo);
        end;
        Rec.FilterGroup(0);
        if ResourceNo <> '' then
            ClearStaleTicks(ResourceNo);
        CurrPage.Update(false);
    end;

    local procedure SetTick(Complete: Boolean)
    var
        Tick: Record "LUM Punch Tick";
    begin
        if Complete then begin
            if Tick.Get(Rec."Line No.") then
                exit;
            Tick.Init();
            Tick."Labor Entry Line No." := Rec."Line No.";
            Tick."Resource No." := Rec."Resource No.";
            Tick."Job No." := Rec."Job No.";
            Tick."Job Task No." := Rec."Job Task No.";
            Tick."Ticked At" := CurrentDateTime();
            Tick.Insert();
        end else
            if Tick.Get(Rec."Line No.") then
                Tick.Delete();
    end;

    local procedure ClearStaleTicks(ResourceNo: Code[20])
    var
        Tick: Record "LUM Punch Tick";
        Stale: Record "LUM Punch Tick";
        LaborEntry: Record "ICG Labor Entry";
    begin
        Tick.SetRange("Resource No.", ResourceNo);
        if Tick.FindSet() then
            repeat
                if not LaborEntry.Get(Tick."Labor Entry Line No.") then
                    if Stale.Get(Tick."Labor Entry Line No.") then
                        Stale.Delete();
            until Tick.Next() = 0;
    end;
}
