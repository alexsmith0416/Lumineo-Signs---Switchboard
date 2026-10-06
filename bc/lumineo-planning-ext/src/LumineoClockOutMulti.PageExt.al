// Clock Out Multiple Projects/Nestings: "Mark tasks complete" — the employee's
// open punches, each with its own Task complete checkbox (page 58412). The
// ticked ones are recorded as they clock out ("Multi Clock Out").
pageextension 58413 "LUM Clock Out Multi" extends ClockOutMultipleJobsNesting
{
    layout
    {
        addafter(OpenPunches)
        {
            part(LUMPunchTicks; "LUM Open Punch Ticks")
            {
                ApplicationArea = All;
            }
        }
        modify("Resource No")
        {
            trigger OnAfterValidate()
            begin
                CurrPage.LUMPunchTicks.Page.SetResource(ResourceNo);
            end;
        }
    }

    actions
    {
        modify(Submit)
        {
            trigger OnBeforeAction()
            begin
                SubmitResourceNo := ResourceNo;
                TaskCompletion.SetPunchSource('Multi Clock Out');
            end;

            trigger OnAfterAction()
            begin
                // Ticks on punches that stayed open are recorded now too.
                TaskCompletion.RecordTicks(SubmitResourceNo, 'Multi Clock Out');
                TaskCompletion.SetPunchSource('');
                CurrPage.LUMPunchTicks.Page.SetResource(ResourceNo);
            end;
        }
    }

    trigger OnOpenPage()
    begin
        CurrPage.LUMPunchTicks.Page.SetResource(ResourceNo);
    end;

    trigger OnClosePage()
    begin
        TaskCompletion.SetPunchSource('');
    end;

    var
        TaskCompletion: Codeunit "LUM Task Completion";
        SubmitResourceNo: Code[20];
}
