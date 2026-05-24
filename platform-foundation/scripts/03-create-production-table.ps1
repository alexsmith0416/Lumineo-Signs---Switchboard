<#
.SYNOPSIS
    Creates lum_productionschedule and lum_userviewpreferences tables in Dataverse.
    Maps directly to the LNI Production Schedule Airtable base (appjphchC6hRzfkMi).
    Safe to re-run (skips existing tables/columns).

.PARAMETER EnvironmentUrl
    https://org8fa22efd.crm.dynamics.com

.EXAMPLE
    .\03-create-production-table.ps1 -EnvironmentUrl "https://org8fa22efd.crm.dynamics.com"
#>
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentUrl
)

$ErrorActionPreference = "Stop"
Write-Host "=== Creating lum_productionschedule + lum_userviewpreferences ===" -ForegroundColor Cyan

$token = az account get-access-token --resource $EnvironmentUrl.TrimEnd('/') --query accessToken --output tsv
if (-not $token) { Write-Error "No token — run az login first."; exit 1 }

$apiBase = $EnvironmentUrl.TrimEnd('/') + "/api/data/v9.2"
$headers = @{
    Authorization      = "Bearer $token"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    Accept             = "application/json"
    "Content-Type"     = "application/json"
}

function lbl($text) {
    @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"
       LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $text; LanguageCode = 1033 })
       UserLocalizedLabel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $text; LanguageCode = 1033 } }
}
function rl($level = "None") {
    @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"
       Value = $level; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
}
function str($n,$d,$max=200) { @{ "@odata.type"="Microsoft.Dynamics.CRM.StringAttributeMetadata"; SchemaName=$n; DisplayName=lbl $d; RequiredLevel=rl; MaxLength=$max; FormatName=@{Value="Text"} } }
function memo($n,$d,$max=4000) { @{ "@odata.type"="Microsoft.Dynamics.CRM.MemoAttributeMetadata"; SchemaName=$n; DisplayName=lbl $d; RequiredLevel=rl; MaxLength=$max } }
function num($n,$d) { @{ "@odata.type"="Microsoft.Dynamics.CRM.DecimalAttributeMetadata"; SchemaName=$n; DisplayName=lbl $d; RequiredLevel=rl; Precision=2; MinValue=-1000000; MaxValue=1000000 } }
function cur($n,$d) { @{ "@odata.type"="Microsoft.Dynamics.CRM.MoneyAttributeMetadata"; SchemaName=$n; DisplayName=lbl $d; RequiredLevel=rl; Precision=2; MinValue=0; MaxValue=10000000 } }
function dt($n,$d) { @{ "@odata.type"="Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; SchemaName=$n; DisplayName=lbl $d; RequiredLevel=rl; Format="DateOnly"; DateTimeBehavior=@{Value="DateOnly"} } }
function bool_($n,$d) {
    @{ "@odata.type"="Microsoft.Dynamics.CRM.BooleanAttributeMetadata"; SchemaName=$n; DisplayName=lbl $d; RequiredLevel=rl
       OptionSet=@{ "@odata.type"="Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"
                    TrueOption=@{Value=1;Label=lbl "Yes"}; FalseOption=@{Value=0;Label=lbl "No"} } }
}

function New-Table($logicalName, $displayName, $pluralName, $description, $attributes) {
    try {
        Invoke-RestMethod -Uri "$apiBase/EntityDefinitions(LogicalName='$logicalName')?`$select=LogicalName" -Headers $headers -Method GET -ErrorAction Stop | Out-Null
        Write-Host "  SKIPPED  $logicalName (already exists)" -ForegroundColor DarkGray
        return
    } catch {
        if ($_.Exception.Response.StatusCode -ne 404) { throw }
    }

    $primaryAttr = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName    = ($logicalName + "_name")
        RequiredLevel = rl "ApplicationRequired"
        MaxLength     = 500
        FormatName    = @{ Value = "Text" }
        IsPrimaryName = $true
        DisplayName   = lbl "Job # / Name"
    }

    $body = @{
        "@odata.type"         = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName            = ($logicalName.Substring(0,1).ToUpper() + $logicalName.Substring(1))
        DisplayName           = lbl $displayName
        DisplayCollectionName = lbl $pluralName
        Description           = lbl $description
        OwnershipType         = "OrgOwned"
        HasActivities         = $false
        HasNotes              = $false
        IsActivity            = $false
        Attributes            = @($primaryAttr) + $attributes
    } | ConvertTo-Json -Depth 20

    try {
        Invoke-RestMethod -Uri "$apiBase/EntityDefinitions" -Headers $headers -Method POST -Body $body | Out-Null
        Write-Host "  CREATED  $logicalName" -ForegroundColor Green
    } catch {
        $msg = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue).error.message
        Write-Host "  ERROR    $logicalName — $($msg ?? $_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n[1/2] lum_productionschedule..." -ForegroundColor Yellow

New-Table "lum_productionschedule" "Production Schedule" "Production Schedules" `
    "LNI production job records synced from Airtable base appjphchC6hRzfkMi" @(

    # --- Identity / match key ---
    str  "lum_ps_airtablerecordid"   "Airtable Record ID"     50    # upsert key
    str  "lum_ps_recordtype"         "Record Type"            50    # Active | Completed

    # --- Core job fields ---
    str  "lum_ps_sales"              "Sales"                  500
    str  "lum_ps_location"           "Location"               200
    str  "lum_ps_region"             "Region"                 100
    memo "lum_ps_description"        "Description"
    str  "lum_ps_priority"           "Priority"               200
    str  "lum_ps_currentstatus"      "Current Status"         200
    memo "lum_ps_jobnotes"           "Job Notes"
    str  "lum_ps_readyforinstall"    "Ready for Install"      100
    str  "lum_ps_powerlines"         "Powerlines"             100
    str  "lum_ps_locates"            "Locates"                100

    # --- Key dates ---
    dt   "lum_ps_datetohold"         "Date to Hold"
    dt   "lum_ps_dateoffhold"        "Date off Hold"
    dt   "lum_ps_orderdate"          "Order Date (Received)"
    dt   "lum_ps_expeditordate"      "Expeditor Date"
    dt   "lum_ps_mfgtargetmodified"  "Mfg Target Modified"
    dt   "lum_ps_scheduledinstall"   "Scheduled Install"
    dt   "lum_ps_dateinstalled"      "Date Installed"
    dt   "lum_ps_datetoadmin"        "Date to Admin"
    dt   "lum_ps_dateinvoiced"       "Date Invoiced"
    dt   "lum_ps_mfgcomplete"        "Mfg Complete Date"
    dt   "lum_ps_reddate"            "RED DATE"
    dt   "lum_ps_tbd"                "TBD Date"

    # --- Admin ---
    memo "lum_ps_adminnotes"         "Admin Notes"

    # --- Vendor ---
    str  "lum_ps_vendor"             "Vendor"                 500
    str  "lum_ps_ponumber"           "P.O. #"                 100
    dt   "lum_ps_vendorshipdate"     "Vendor Ship Date"
    dt   "lum_ps_vendorshipdate2"    "2nd Vendor Ship Date"
    str  "lum_ps_vendorstatus"       "Vendor Status"          100
    dt   "lum_ps_outsourcedarrival"  "Outsourced Arrival"

    # --- Vinyl / Routing ---
    dt   "lum_ps_vinylordered"       "Vinyl Ordered"
    dt   "lum_ps_vinylcomplete"      "Vinyl Complete"
    dt   "lum_ps_vinylprodstartdate" "Vinyl Prod Start Date"
    str  "lum_ps_vinylinstaller"     "Vinyl Installer"        200
    dt   "lum_ps_routingordered"     "Routing Ordered"
    dt   "lum_ps_routingcomplete"    "Routing Complete"
    dt   "lum_ps_routingstartdate"   "Routing Start Date"
    str  "lum_ps_routingtype"        "Routing Type"           100
    num  "lum_ps_routinghrs"         "Routing Hrs"

    # --- Mfg production fields ---
    memo "lum_ps_mfgnotes"           "Mfg Notes"
    str  "lum_ps_graphics"           "Graphics"               200
    memo "lum_ps_graphicsnotes"      "Graphics Notes"
    str  "lum_ps_metal"              "Metal"                  100
    num  "lum_ps_paintprep"          "Paint Prep Hrs"
    num  "lum_ps_paint"              "Paint Hrs"
    str  "lum_ps_assembly"           "Assembly"               100
    str  "lum_ps_plexapplication"    "Plex/Application"       100
    str  "lum_ps_vinylprodpatterns"  "Vinyl Prod/Install/Patterns" 100
    num  "lum_ps_steel"              "Steel Hrs"
    num  "lum_ps_install"            "Install Hrs"
    num  "lum_ps_travel"             "Travel Hrs"
    str  "lum_ps_paintpreppaint"     "Paint Prep/Paint Stage" 100
    num  "lum_ps_paintpreppaint2"    "Paint Prep/Paint 2 Hrs"
    str  "lum_ps_materialcut"        "Material Cut"           100
    str  "lum_ps_mfgregion"          "MFG Region"             100
    str  "lum_ps_installregion"      "Install Region"         100
    str  "lum_ps_mfgrating"          "MFG Rating"             200
    str  "lum_ps_installarea"        "Install Area"           100

    # --- Financial ---
    cur  "lum_ps_value"              "Value"
    str  "lum_ps_deposit"            "Deposit"                100
    str  "lum_ps_billdayjob"         "Bill Day Job"           100

    # --- Process / misc ---
    str  "lum_ps_process"            "Process"                100
    str  "lum_ps_signtypes"          "Sign Types"             100
    str  "lum_ps_emccontent"         "EMC Content"            200
    str  "lum_ps_paintcolor"         "Paint Color"            200
    str  "lum_ps_storagelocation"    "Storage Location"       200
    dt   "lum_ps_dateshipped"        "Date Shipped"
    dt   "lum_ps_dateshipped2"       "Date Shipped 2"

    # --- Due date overrides (user-editable) ---
    dt   "lum_ps_routingduedatemod"  "Routing Due Date Modified"
    dt   "lum_ps_metalduedatemod"    "Metal Due Date Modified"
    dt   "lum_ps_ppduedatemod"       "Paint Prep/Paint Due Date Modified"
    dt   "lum_ps_matcutduedatemod"   "Material Cut Due Date Modified"
    dt   "lum_ps_assemblyduedatemod" "Assembly Due Date Modified"

    # --- Checkboxes ---
    bool_ "lum_ps_ulsign"            "UL Sign"
    bool_ "lum_ps_qt"                "Q.T."
    bool_ "lum_ps_aidenorHunter"     "Aiden or Hunter"
    bool_ "lum_ps_aiden"             "Aiden"
    bool_ "lum_ps_hunter"            "Hunter"
)

Write-Host "`n[2/2] lum_userviewpreferences..." -ForegroundColor Yellow

New-Table "lum_userviewpreferences" "User View Preferences" "User View Preferences" `
    "Per-user column visibility and order preferences for lum_productionschedule" @(
    str  "lum_uvp_userid"       "User ID (Azure OID)"  100
    str  "lum_uvp_viewname"     "View Name"            100
    memo "lum_uvp_hiddenfields" "Hidden Fields JSON"   4000
    memo "lum_uvp_fieldorder"   "Field Order JSON"     4000
)

Write-Host "`n=== Done. Run 04-airtable-sync-flow.md next for flow setup. ===" -ForegroundColor Cyan
