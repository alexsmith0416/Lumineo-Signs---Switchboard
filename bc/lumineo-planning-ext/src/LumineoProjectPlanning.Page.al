// Writable OData surface over Infotech's per-job planning table (71441977).
// Infotech ships no page over this table — their subform shows it through the
// step catalogue (71441976), which carries no job context over OData. Publish
// this page as the web service `LumineoProjectPlanning`; the key is the table's
// primary key, so a row is addressed as
//   LumineoProjectPlanning(Project_No='J32865',Code=<step guid>)
// with the GUID literal UNQUOTED.
//
// A job only has rows for steps someone has touched, so the push flow also
// CREATES rows: POST { Project_No, Step_Description, Sched_Start, ... }. The
// step is named, not coded — catalogue GUIDs differ per environment — and the
// page copies Code, Planning Area and the sort/indent fields from the catalogue
// row, as ICG's own rows carry them. Project_No and Step_Description are
// settable ONLY on a new row (an existing row always has a Code).
//
// WRITE THE SCHEDULE ONLY THROUGH Sched_Start / Sched_End. The table stores each
// moment twice — "<X> DateTime" in UTC and a Date+Time pair in the WRITER's
// local time — and Infotech's OnValidate converts between them in the SESSION
// time zone. The push flow's service principal runs in UTC, so writing either
// raw side leaves the pair 5-6 h off for people reading it in BC. Validating
// "Start DateTime" also flips Started to true. Sched_* set the UTC value through
// Infotech's validation (so Duration etc. stay right), then pin the pair to
// Central wall-clock time and put back any Started/Complete side effect.
page 58400 "Lumineo Project Planning"
{
    Caption = 'Lumineo Project Planning';
    PageType = List;
    SourceTable = "ICG.IPP.ProjectPlanning";
    ApplicationArea = All;
    UsageCategory = Lists;
    InsertAllowed = true;
    DeleteAllowed = false;
    ModifyAllowed = true;
    DelayedInsert = true;

    layout
    {
        area(Content)
        {
            repeater(Lines)
            {
                // Identity — never written by the scheduler.
                // Identity — set on create only, never changed afterwards.
                field(Project_No; Rec."Project No.")
                {
                    trigger OnValidate()
                    begin
                        if not IsNullGuid(Rec.Code) then
                            Error(IdentityFixedErr, 'Project_No');
                    end;
                }
                field(Code; Rec.Code) { Editable = false; }
                field(Step_Description; StepDescription)
                {
                    Caption = 'Step Description';
                    ToolTip = 'Catalogue name of the step. Step GUIDs differ per environment, so resolve by this, never by a hardcoded Code. Settable only when creating a row.';
                    trigger OnValidate()
                    begin
                        if not IsNullGuid(Rec.Code) then
                            Error(IdentityFixedErr, 'Step_Description');
                        SetStepFromCatalogue(StepDescription);
                    end;
                }
                field(Planning_Area; Rec."Planning Area") { Editable = false; }
                field(Parent_Sort_Order; Rec."Parent Sort Order") { Editable = false; }
                field(Sort_Order; Rec."Sort Order") { Editable = false; }
                field(Indentation; Rec.Indentation) { Editable = false; }

                // Schedule write-back — the ONLY writable dates. UTC in, UTC out;
                // 0001-01-01T00:00:00Z clears.
                field(Sched_Start; SchedStart)
                {
                    Caption = 'Scheduled Start (UTC)';
                    ToolTip = 'Sets Start DateTime (UTC) and the Start Date/Time pair in Central time. Does not change Started.';
                    trigger OnValidate()
                    begin
                        SetMoment(SchedStart, true);
                    end;
                }
                field(Sched_End; SchedEnd)
                {
                    Caption = 'Scheduled End (UTC)';
                    ToolTip = 'Sets End DateTime (UTC) and the End Date/Time pair in Central time. Does not change Started or Complete.';
                    trigger OnValidate()
                    begin
                        SetMoment(SchedEnd, false);
                    end;
                }

                // Raw storage — read-only here so nothing writes one side of a
                // pair by mistake. "Start Date"/"Due Date" are obsoleted by ICG.
                field(Start_DateTime; Rec."Start DateTime") { Editable = false; }
                field(Start_Date_2; Rec."Start Date 2") { Editable = false; }
                field(Start_Time; Rec."Start Time") { Editable = false; }
                field(End_DateTime; Rec."End DateTime") { Editable = false; }
                field(End_Date; Rec."End Date") { Editable = false; }
                field(End_Time; Rec."End Time") { Editable = false; }
                field(Due_DateTime; Rec."Due DateTime") { Editable = false; }
                field(Due_Date_2; Rec."Due Date 2") { Editable = false; }
                field(Due_Time; Rec."Due Time") { Editable = false; }
                field(Duration; Rec.Duration) { Editable = false; }

                // Assignee is a Resource No. (Type = Person), not a name. ICG's
                // validation of "Assigned To" sets Started := true (even when
                // clearing it) and, on a row with no start, sets the start to
                // NOW — both verified in UAT Sep 28. Like Sched_*, this validates
                // through ICG and then puts the flags and the schedule back:
                // assigning someone changes who, never when or whether started.
                field(Assigned_To; AssignedTo)
                {
                    Caption = 'Assigned To';
                    TableRelation = Resource."No." where(Type = const(Person), Blocked = const(false));
                    trigger OnValidate()
                    var
                        Before: Record "ICG.IPP.ProjectPlanning";
                    begin
                        Before := Rec;
                        Rec.Validate("Assigned To", AssignedTo);
                        Rec.Started := Before.Started;
                        Rec.Complete := Before.Complete;
                        Rec."Start DateTime" := Before."Start DateTime";
                        Rec."Start Date 2" := Before."Start Date 2";
                        Rec."Start Time" := Before."Start Time";
                        Rec."End DateTime" := Before."End DateTime";
                        Rec."End Date" := Before."End Date";
                        Rec."End Time" := Before."End Time";
                        Rec.Duration := Before.Duration;
                    end;
                }
                field(Assigned_To_Name; Rec."Assigned To Name") { Editable = false; }

                field(Started; Rec.Started) { }
                field(Complete; Rec.Complete) { }
                field(Completed_Date; Rec."Completed Date") { }
                field(Completed_By; Rec."Completed By") { }
                field(Completed_By_Name; Rec."Completed By Name") { Editable = false; }
                field(Quick_Notes; Rec."Quick Notes") { }

                field(Status; Rec.Status) { Editable = false; }
                field(Project_Scheduled; Rec."Project Scheduled") { Editable = false; }
                field(Trips_Resources; Rec."Trips/Resources") { Editable = false; }

                field(SystemId; Rec.SystemId) { Editable = false; }
                field(SystemModifiedAt; Rec.SystemModifiedAt) { Editable = false; }
            }
        }
    }

    trigger OnAfterGetRecord()
    var
        Step: Record "ICG.IPP.ProjectPlanningStep";
    begin
        Rec.CalcFields("Assigned To Name", "Completed By Name", Status, "Project Scheduled", "Trips/Resources");
        StepDescription := '';
        if Step.Get(Rec.Code) then
            StepDescription := Step.Description;
        SchedStart := Rec."Start DateTime";
        SchedEnd := Rec."End DateTime";
        AssignedTo := Rec."Assigned To";
    end;

    trigger OnInsertRecord(BelowxRec: Boolean): Boolean
    begin
        if (Rec."Project No." = '') or IsNullGuid(Rec.Code) then
            Error(NewRowNeedsIdentityErr);
        exit(true); // a trigger with no exit value returns false = "don't insert"
    end;

    local procedure SetStepFromCatalogue(Description: Text)
    var
        Step: Record "ICG.IPP.ProjectPlanningStep";
    begin
        Step.SetRange(Description, Description);
        case Step.Count() of
            0:
                Error(UnknownStepErr, Description);
            1:
                Step.FindFirst();
            else
                Error(AmbiguousStepErr, Description);
        end;
        Rec.Code := Step.Code;
        Rec."Planning Area" := Step."Planning Area";
        Rec."Parent Sort Order" := Step."Parent Sort Order";
        Rec."Sort Order" := Step."Sort Order";
        Rec.Indentation := Step.Indentation;
    end;

    local procedure SetMoment(UtcValue: DateTime; IsStart: Boolean)
    var
        WasStarted: Boolean;
        WasComplete: Boolean;
        LocalDate: Date;
        LocalTime: Time;
    begin
        WasStarted := Rec.Started;
        WasComplete := Rec.Complete;

        // Through ICG's validation, so Duration and anything else it derives stay
        // consistent — then overwrite what it gets wrong for a UTC session.
        if IsStart then
            Rec.Validate("Start DateTime", UtcValue)
        else
            Rec.Validate("End DateTime", UtcValue);

        LocalDate := 0D;
        LocalTime := 0T;
        if UtcValue <> 0DT then
            ToBusinessWallClock(UtcValue, LocalDate, LocalTime);

        if IsStart then begin
            Rec."Start DateTime" := UtcValue;
            Rec."Start Date 2" := LocalDate;
            Rec."Start Time" := LocalTime;
        end else begin
            Rec."End DateTime" := UtcValue;
            Rec."End Date" := LocalDate;
            Rec."End Time" := LocalTime;
        end;

        // ICG derives Duration only from the Date/Time pair's OnValidate, which we
        // bypass. It is plain elapsed End - Start (J31949 Routing: P2DT9H).
        if (Rec."Start DateTime" <> 0DT) and (Rec."End DateTime" <> 0DT) then
            Rec.Duration := Rec."End DateTime" - Rec."Start DateTime"
        else
            Rec.Duration := 0;

        // Scheduling is not starting: undo ICG's Started/Complete side effects.
        Rec.Started := WasStarted;
        Rec.Complete := WasComplete;
    end;

    // Central wall-clock date/time for a UTC instant, independent of the session's
    // own time zone (UTC for the service principal, Central for a person). The
    // offset is taken AT that instant, so daylight saving is handled.
    local procedure ToBusinessWallClock(UtcValue: DateTime; var LocalDate: Date; var LocalTime: Time)
    var
        TimeZone: Codeunit "Time Zone";
        Shifted: DateTime;
    begin
        // DT2Date/DT2Time render in the session zone; cancel that, apply Central.
        Shifted := UtcValue
            + TimeZone.GetTimezoneOffset(UtcValue, BusinessTimeZoneTok)
            - TimeZone.GetTimezoneOffset(UtcValue);
        LocalDate := DT2Date(Shifted);
        LocalTime := DT2Time(Shifted);
    end;

    var
        StepDescription: Text[100];
        SchedStart: DateTime;
        SchedEnd: DateTime;
        AssignedTo: Code[20];
        BusinessTimeZoneTok: Label 'Central Standard Time', Locked = true;
        IdentityFixedErr: Label '%1 can only be set when creating a row.', Comment = '%1 = field name';
        NewRowNeedsIdentityErr: Label 'A new row needs Project_No and Step_Description.';
        UnknownStepErr: Label 'No planning step named ''%1'' in the step catalogue.', Comment = '%1 = step description';
        AmbiguousStepErr: Label 'More than one planning step is named ''%1''; it can''t be created by name.', Comment = '%1 = step description';
}
