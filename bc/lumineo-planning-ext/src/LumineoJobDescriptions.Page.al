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
//
// v1.0.0.15 adds orderType — the Job Card's "Order Type" (SERVICE, SIGNCONT,
// MNTCCONT, SALES…; the app gives SERVICE / SIGNCONT / MNTCCONT jobs the
// Service stepper). It isn't in any BC API and its field number isn't in the
// Infotech symbols we have, so the page finds the Job field CAPTIONED "Order
// Type" (falling back to Sign365's 95294 "Service Order") and says which one
// it read in orderTypeField. When that's blank (it is in UAT — v1.0.0.16), the
// code comes from Description 2, which BC fills with the order type's NAME:
// the Service-type Resource with that Name (e.g. "Service Order" → SERVICE).
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
                field(orderType; OrderType) { }
                field(orderTypeField; OrderTypeFieldNo) { }
                field(description2; Rec."Description 2") { }
            }
        }
    }

    var
        FieldDescription: Text;
        ProductionDescription: Text;
        ExtendedDescription: Text;
        OrderType: Text;
        OrderTypeFieldNo: Integer;

    trigger OnOpenPage()
    begin
        OrderTypeFieldNo := FindOrderTypeField();
    end;

    trigger OnAfterGetRecord()
    var
        RecRef: RecordRef;
    begin
        RecRef.GetTable(Rec);
        FieldDescription := BlobText(RecRef, 60215);
        ProductionDescription := BlobText(RecRef, 60214);
        ExtendedDescription := BlobText(RecRef, 60202);
        OrderType := '';
        if OrderTypeFieldNo <> 0 then
            OrderType := Format(RecRef.Field(OrderTypeFieldNo).Value);
        // v1.0.0.16: UAT has no Job field captioned "Order Type" (the caption is
        // the page's), and 95294 is blank on every job. But BC copies the Order
        // Type resource's NAME into Description 2 ("Service Order" on 136 of 707
        // open jobs, Oct 7) — so the code is the Service-type resource with that
        // name (SERVICE, SIGNCONT, MNTCCONT, SALES…).
        if OrderType = '' then
            OrderType := OrderTypeFromDescription2(Rec."Description 2");
    end;

    // The resource whose Name is this Description 2 ("" when none). The order
    // types are Resources of Infotech's "Service" type — an enum value from
    // their extension we don't depend on — so the match is on the (unique)
    // name alone: "Service Order" → SERVICE.
    local procedure OrderTypeFromDescription2(Desc2: Text[100]): Code[20]
    var
        Res: Record Resource;
    begin
        if Desc2 = '' then
            exit('');
        Res.SetRange(Name, Desc2);
        if Res.FindFirst() then
            exit(Res."No.");
        exit('');
    end;

    // The Job field captioned "Order Type", else Sign365's "Service Order" (95294), else 0.
    local procedure FindOrderTypeField(): Integer
    var
        RecRef: RecordRef;
        FRef: FieldRef;
        i: Integer;
    begin
        RecRef.Open(Database::Job);
        for i := 1 to RecRef.FieldCount do begin
            FRef := RecRef.FieldIndex(i);
            if (FRef.Caption = 'Order Type') and (FRef.Class = FieldClass::Normal) then
                exit(FRef.Number);
        end;
        if RecRef.FieldExist(95294) then
            exit(95294);
        exit(0);
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
