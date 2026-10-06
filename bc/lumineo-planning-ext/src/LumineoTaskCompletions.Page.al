// Read-only API over "LUM Task Completion" for the BCSync_TaskCompletions flow.
//   GET .../api/lumineo/planning/v1.0/companies(<id>)/taskCompletions
//       ?$filter=entryNo gt 123
// jobTaskDescription helps the app map a task to a department.
page 58411 "Lumineo Task Completions API"
{
    Caption = 'Lumineo Task Completions';
    PageType = API;
    APIPublisher = 'lumineo';
    APIGroup = 'planning';
    APIVersion = 'v1.0';
    EntityName = 'taskCompletion';
    EntitySetName = 'taskCompletions';
    SourceTable = "LUM Task Completion";
    ODataKeyFields = SystemId;
    DelayedInsert = true;
    Editable = false;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;
    DataAccessIntent = ReadOnly;

    layout
    {
        area(Content)
        {
            repeater(Rows)
            {
                field(id; Rec.SystemId) { }
                field(entryNo; Rec."Entry No.") { }
                field(resourceNo; Rec."Resource No.") { }
                field(resourceName; Rec."Resource Name") { }
                field(jobNo; Rec."Job No.") { }
                field(jobTaskNo; Rec."Job Task No.") { }
                field(jobTaskDescription; JobTaskDescription) { }
                field(completedAt; Rec."Completed At") { }
                field(source; Rec.Source) { }
                field(completedBy; Rec."Completed By") { }
            }
        }
    }

    var
        JobTaskDescription: Text;

    trigger OnAfterGetRecord()
    var
        JobTask: Record "Job Task";
    begin
        JobTaskDescription := '';
        if JobTask.Get(Rec."Job No.", Rec."Job Task No.") then
            JobTaskDescription := JobTask.Description;
    end;
}
