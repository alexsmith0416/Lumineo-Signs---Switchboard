// Read-only API: each job's Field / Production / Extended Description.
// They're Blob fields that the "Lumineo Signs - Projects" extension (Infotech,
// c4333fb6) adds to Job — tableextension 60200 "ICG.LMN.Job":
//   60215 ICG.LMN.FieldDescription     "Field Description"
//   60214 ICG.LMN.ProdDescription      "Production Description"
//   60202 ICG.LMN.ExtendedDescription  "Extended Description"
// A Blob can't be returned by an API or a query, so this page reads each one
// into text. It reads them by field NUMBER through RecordRef, so there is no
// dependency on Infotech's extension: a field that doesn't exist reads as "".
//
//   GET .../api/lumineo/planning/v1.0/companies(<id>)/jobDescriptions
//       ?$filter=status eq 'Open'&$select=jobNo,fieldDescription,...
// lastModified (the Job's SystemModifiedAt) moves when a description is saved,
// so a sync can ask only for what changed.
page 58403 "Lumineo Job Descriptions API"
{
    Caption = 'Lumineo Job Descriptions';
    PageType = API;
    APIPublisher = 'lumineo';
    APIGroup = 'planning';
    APIVersion = 'v1.0';
    EntityName = 'jobDescription';
    EntitySetName = 'jobDescriptions';
    SourceTable = Job;
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
                field(jobNo; Rec."No.") { }
                field(status; Rec.Status) { }
                field(lastModified; Rec.SystemModifiedAt) { }
                field(fieldDescription; FieldDescription) { }
                field(productionDescription; ProductionDescription) { }
                field(extendedDescription; ExtendedDescription) { }
            }
        }
    }

    var
        FieldDescription: Text;
        ProductionDescription: Text;
        ExtendedDescription: Text;

    trigger OnAfterGetRecord()
    var
        RecRef: RecordRef;
    begin
        RecRef.GetTable(Rec);
        FieldDescription := BlobText(RecRef, 60215);
        ProductionDescription := BlobText(RecRef, 60214);
        ExtendedDescription := BlobText(RecRef, 60202);
    end;

    // BC writes a Blob in its default MSDos encoding unless told otherwise —
    // which is how Infotech's description fields are stored: ’ is byte C2 and
    // ” is C4 there (J29295 "5’-10” x 2’-4”"). Pure-ASCII text reads the same in
    // every encoding; text saved as UTF-8 (e.g. by an import) reads as UTF-8. So:
    // UTF-8 first — MSDos text with any special character isn't valid UTF-8 and
    // throws "Invalid data encountered in stream" — else MSDos (every byte is
    // valid there, so it can't fail). v1.0.0.10 fell back to Windows, which
    // showed ’ ” as Â Ä.
    local procedure BlobText(var RecRef: RecordRef; FieldNo: Integer): Text
    var
        TempBlob: Codeunit "Temp Blob";
        FRef: FieldRef;
        Result: Text;
    begin
        if not RecRef.FieldExist(FieldNo) then
            exit('');
        FRef := RecRef.Field(FieldNo);
        if FRef.Type <> FieldType::Blob then
            exit('');
        FRef.CalcField();
        TempBlob.FromFieldRef(FRef);
        if not TempBlob.HasValue() then
            exit('');
        if TryReadText(TempBlob, TextEncoding::UTF8, Result) then
            exit(Result);
        if TryReadText(TempBlob, TextEncoding::MSDos, Result) then
            exit(Result);
        exit('');
    end;

    [TryFunction]
    local procedure TryReadText(var TempBlob: Codeunit "Temp Blob"; Encoding: TextEncoding; var Result: Text)
    var
        TypeHelper: Codeunit "Type Helper";
        InS: InStream;
    begin
        TempBlob.CreateInStream(InS, Encoding);
        Result := TypeHelper.ReadAsTextWithSeparator(InS, TypeHelper.LFSeparator());
    end;
}
