// Clock In Job (BC: "Clock In Project"): "Complete current task" — ticking it
// marks the task the employee is leaving as done. Always shown, but greyed
// out unless they are punched into a job right now (first punch of the day).
pageextension 58410 "LUM Clock In Job" extends "ICG Clock In Job"
{
    layout
    {
        addafter("Job Task No.")
        {
            field(LUMCurrentTask; CurrentTaskText)
            {
                ApplicationArea = All;
                Caption = 'Currently on';
                Editable = false;
                ToolTip = 'The project and task you are punched into now. Tick Complete current task if you finished it.';
            }
            field(LUMCompleteCurrent; CompleteCurrent)
            {
                ApplicationArea = All;
                Caption = 'Complete current task';
                Enabled = IsOnJob;
                ToolTip = 'Tick if you finished the task you are punched into now. Clocking in to the new job then marks that department complete on the job.';

                trigger OnValidate()
                begin
                    TaskCompletion.SetPending(ResourceNo, CompleteCurrent);
                end;
            }
        }
        modify("Resource No.")
        {
            trigger OnAfterValidate()
            begin
                RefreshCurrent();
            end;
        }
    }

    trigger OnOpenPage()
    begin
        RefreshCurrent();
    end;

    trigger OnClosePage()
    begin
        TaskCompletion.SetPending(ResourceNo, false);
    end;

    var
        TaskCompletion: Codeunit "LUM Task Completion";
        CurrentTaskText: Text;
        CompleteCurrent: Boolean;
        IsOnJob: Boolean;

    local procedure RefreshCurrent()
    var
        ShopFloorForJobs: Codeunit "ICG Shop Floor for Jobs";
        JobTask: Record "Job Task";
        CurJobNo: Code[20];
        CurTaskNo: Code[20];
    begin
        if CompleteCurrent then
            TaskCompletion.SetPending(ResourceNo, false);
        CompleteCurrent := false;
        IsOnJob := false;
        CurrentTaskText := '';
        if ResourceNo = '' then
            exit;
        ShopFloorForJobs.GetClockedIn(ResourceNo, CurJobNo, CurTaskNo);
        if CurJobNo = '' then begin
            CurrentTaskText := 'Not clocked in to a project';
            exit;
        end;
        IsOnJob := true;
        CurrentTaskText := CurJobNo;
        if CurTaskNo <> '' then begin
            CurrentTaskText += ' / ' + CurTaskNo;
            if JobTask.Get(CurJobNo, CurTaskNo) and (JobTask.Description <> '') then
                CurrentTaskText += ' ' + JobTask.Description;
        end;
    end;
}
