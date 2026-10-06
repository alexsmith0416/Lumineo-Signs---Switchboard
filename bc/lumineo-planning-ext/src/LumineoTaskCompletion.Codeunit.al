// Carries the "Task complete" tick from the Clock In Job / Clock Out Job page
// extensions to the moment Infotech's page submits the punch, and records it.
// The Multiple Projects pages tick each open punch instead (table 58411,
// page 58412); those are recorded as the punch closes or the page submits.
//
// The page extensions can't hook Infotech's Submit action directly, so a tick
// is held here (per resource, for this session) and consumed by the pages' own
// OnSubmitOnBefore… events. Recording happens inside the same transaction as
// the punch: if Infotech's clock-in/out fails, the completion rolls back too.
codeunit 58410 "LUM Task Completion"
{
    SingleInstance = true;
    InherentPermissions = X;
    InherentEntitlements = X;

    var
        PendingResourceNo: Code[20];
        PunchSource: Text[20];

    /// Which Multiple Projects page is submitting ('' = none) — the Source on
    /// completions recorded while it runs.
    procedure SetPunchSource(Source: Text[20])
    begin
        PunchSource := Source;
    end;

    procedure SetPending(ResourceNo: Code[20]; Complete: Boolean)
    begin
        if Complete then
            PendingResourceNo := ResourceNo
        else
            if PendingResourceNo = ResourceNo then
                Clear(PendingResourceNo);
    end;

    local procedure TakePending(ResourceNo: Code[20]): Boolean
    begin
        if (ResourceNo = '') or (PendingResourceNo <> ResourceNo) then
            exit(false);
        Clear(PendingResourceNo);
        exit(true);
    end;

    // Moving straight to another job: the tick completes the job + task the
    // employee is punched into right now (the one this clock-in closes).
    [EventSubscriber(ObjectType::Page, Page::"ICG Clock In Job", 'OnSubmitOnBeforeClockInJob', '', false, false)]
    local procedure OnClockInJob(LaborEntry: Record "ICG Labor Entry")
    var
        ShopFloorForJobs: Codeunit "ICG Shop Floor for Jobs";
        CurJobNo: Code[20];
        CurTaskNo: Code[20];
    begin
        if not TakePending(LaborEntry."Resource No.") then
            exit;
        ShopFloorForJobs.GetClockedIn(LaborEntry."Resource No.", CurJobNo, CurTaskNo);
        RecordCompletion(LaborEntry."Resource No.", CurJobNo, CurTaskNo, 'Clock In');
    end;

    // Clocking out: the tick completes the job + task being clocked out of.
    [EventSubscriber(ObjectType::Page, Page::"ICG Clock Out Job", 'OnSubmitOnBeforeClockOutJob', '', false, false)]
    local procedure OnClockOutJob(LaborEntry: Record "ICG Labor Entry")
    begin
        if not TakePending(LaborEntry."Resource No.") then
            exit;
        RecordCompletion(LaborEntry."Resource No.", LaborEntry."Job No.", LaborEntry."Job Task No.", 'Clock Out');
    end;

    // Multiple Projects pages: a ticked punch (table 58411) is recorded the
    // moment it closes, whichever page or process closes it.
    [EventSubscriber(ObjectType::Table, Database::"ICG Labor Entry", 'OnAfterModifyEvent', '', false, false)]
    local procedure OnLaborEntryModified(var Rec: Record "ICG Labor Entry"; var xRec: Record "ICG Labor Entry"; RunTrigger: Boolean)
    var
        Tick: Record "LUM Punch Tick";
        Source: Text[20];
    begin
        if Rec.IsTemporary() then
            exit;
        if Rec."DateTime Out" = 0DT then
            exit;
        if not Tick.Get(Rec."Line No.") then
            exit;
        Source := PunchSource;
        if Source = '' then
            Source := 'Punch closed';
        RecordCompletion(Tick."Resource No.", Tick."Job No.", Tick."Job Task No.", Source);
        Tick.Delete();
    end;

    /// Record (and clear) every tick an employee still has — called after a
    /// Multiple Projects page submits, for punches that stayed open.
    procedure RecordTicks(ResourceNo: Code[20]; Source: Text[20])
    var
        Tick: Record "LUM Punch Tick";
        Done: Record "LUM Punch Tick";
    begin
        if ResourceNo = '' then
            exit;
        Tick.SetRange("Resource No.", ResourceNo);
        if Tick.FindSet() then
            repeat
                RecordCompletion(Tick."Resource No.", Tick."Job No.", Tick."Job Task No.", Source);
                if Done.Get(Tick."Labor Entry Line No.") then
                    Done.Delete();
            until Tick.Next() = 0;
    end;

    local procedure RecordCompletion(ResourceNo: Code[20]; JobNo: Code[20]; JobTaskNo: Code[20]; Source: Text[20])
    var
        Completion: Record "LUM Task Completion";
        Recent: Record "LUM Task Completion";
        Resource: Record Resource;
    begin
        if JobNo = '' then
            exit;
        // The same task ticked twice in one go (e.g. on Clock In Job and on the
        // Multiple Projects list) is one completion.
        Recent.SetRange("Resource No.", ResourceNo);
        Recent.SetRange("Job No.", JobNo);
        Recent.SetRange("Job Task No.", JobTaskNo);
        Recent.SetFilter("Completed At", '>=%1', CurrentDateTime() - 2 * 60 * 1000);
        if not Recent.IsEmpty() then
            exit;
        Completion.Init();
        Completion."Resource No." := ResourceNo;
        if Resource.Get(ResourceNo) then
            Completion."Resource Name" := Resource.Name;
        Completion."Job No." := JobNo;
        Completion."Job Task No." := JobTaskNo;
        Completion."Completed At" := CurrentDateTime();
        Completion.Source := Source;
        Completion."Completed By" := CopyStr(UserId(), 1, MaxStrLen(Completion."Completed By"));
        Completion.Insert(true);
    end;
}
