// Lets the BC flows' service principal ("PowerApps Permissions") run the job PO
// queries through a permission set it ALREADY holds, so nothing has to be
// assigned. LUM PLANNING WB can't be assigned by the app user itself (BC's
// SECURITY set only hands out sets the assigner holds), and an admin round-trip
// means disabling the app card and stopping the BCSync_* flows.
//
// Only Execute on the two read-only queries: everyone with D365 BUS FULL ACCESS
// already reads Purchase Header / Line and their archives, so this exposes
// nothing new — it just lets those users run these two queries.
// Once LUM PLANNING WB is assigned to the app card (production cutover) this
// extension can be removed.
permissionsetextension 58400 "LUM JOB PO READ" extends "D365 BUS FULL ACCESS"
{
    Permissions =
        query "Lumineo Job POs" = X,
        query "Lumineo Job PO Archive" = X;
}
