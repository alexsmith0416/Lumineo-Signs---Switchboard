// Clock In Multiple Projects/Nestings: "Mark tasks complete" — the employee's
// open punches, each with its own Task complete checkbox (page 58412). A
// ticked punch is recorded when it closes; this page marks such closings as
// "Multi Clock In".
pageextension 58412 "LUM Clock In Multi" extends "Clock In Multiple Jobs/Nesting"
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
                TaskCompletion.SetPunchSource('Multi Clock In');
            end;

            trigger OnAfterAction()
            begin
                // Ticks on punches that stayed open are recorded now too.
                TaskCompletion.RecordTicks(SubmitResourceNo, 'Multi Clock In');
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
