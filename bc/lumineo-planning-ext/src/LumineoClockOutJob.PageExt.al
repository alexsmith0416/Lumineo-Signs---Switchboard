// Clock Out Job: "Task complete" — tick it when clocking out at the end of a
// task (before lunch, end of day) to mark that department complete on the job.
pageextension 58411 "LUM Clock Out Job" extends "ICG Clock Out Job"
{
    layout
    {
        addafter("Job Task No.")
        {
            field(LUMTaskComplete; TaskComplete)
            {
                ApplicationArea = All;
                Caption = 'Task complete';
                ToolTip = 'Tick if you finished this task. Clocking out then marks that department complete on the job.';

                trigger OnValidate()
                begin
                    TaskCompletion.SetPending(ResourceNo, TaskComplete);
                end;
            }
        }
        modify("Resource No.")
        {
            trigger OnAfterValidate()
            begin
                if TaskComplete then
                    TaskCompletion.SetPending(ResourceNo, true);
            end;
        }
    }

    trigger OnClosePage()
    begin
        TaskCompletion.SetPending(ResourceNo, false);
    end;

    var
        TaskCompletion: Codeunit "LUM Task Completion";
        TaskComplete: Boolean;
}
