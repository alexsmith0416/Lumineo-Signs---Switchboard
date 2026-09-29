// Everything the BC push flow's service principal needs to use the page.
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
        tabledata Resource = R;
}
