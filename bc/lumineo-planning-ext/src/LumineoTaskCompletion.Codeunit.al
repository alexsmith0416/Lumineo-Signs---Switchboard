// Carries the "Task complete" tick from the Clock In Job / Clock Out Job page
// extensions to the moment Infotech's page submits the punch, and records it.
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

    local procedure RecordCompletion(ResourceNo: Code[20]; JobNo: Code[20]; JobTaskNo: Code[20]; Source: Text[20])
    var
        Completion: Record "LUM Task Completion";
        Resource: Record Resource;
    begin
        if JobNo = '' then
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
