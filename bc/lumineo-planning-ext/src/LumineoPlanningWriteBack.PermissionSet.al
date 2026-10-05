// Everything the BC flows' service principal needs: the planning page (push)
// and the job PO queries (read).
// Assign to the Entra Application Card alongside ICG.PROJPLANNING.ADM (or in
// place of it, once verified — this is narrower).
permissionset 58400 "LUM PLANNING WB"
{
    Caption = 'Lumineo Planning Write-back';
    Assignable = true;
    Permissions =
        page "Lumineo Project Planning" = X,
        tabledata "ICG.IPP.ProjectPlanning" = RIM,
        tabledata "ICG.IPP.ProjectPlanningStep" = R,
        tabledata "ICG.IPP.ProjPlanTripResource" = R,
        tabledata Job = R,
        tabledata Resource = R,
        // Job POs (read-only queries for the sync flow).
        query "Lumineo Job POs" = X,
        query "Lumineo Job PO Archive" = X,
        tabledata "Purchase Header" = R,
        tabledata "Purchase Line" = R,
        tabledata "Purchase Header Archive" = R,
        tabledata "Purchase Line Archive" = R;
}
