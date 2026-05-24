<#
.SYNOPSIS
    Adds Airtable-sync columns to lum_job that weren't in the initial schema.
    Safe to re-run — skips columns that already exist.

.PARAMETER EnvironmentUrl
    https://org8fa22efd.crm.dynamics.com
#>
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentUrl
)

$ErrorActionPreference = "Stop"
Write-Host "=== Adding Airtable sync columns to lum_job ===" -ForegroundColor Cyan

$token = az account get-access-token --resource $EnvironmentUrl.TrimEnd('/') --query accessToken --output tsv
$apiBase = $EnvironmentUrl.TrimEnd('/') + "/api/data/v9.2"
$headers = @{
    Authorization      = "Bearer $token"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    Accept             = "application/json"
    "Content-Type"     = "application/json"
}

function lbl($text) {
    @{ "@odata.type"="Microsoft.Dynamics.CRM.Label"
       LocalizedLabels=@(@{"@odata.type"="Microsoft.Dynamics.CRM.LocalizedLabel";Label=$text;LanguageCode=1033})
       UserLocalizedLabel=@{"@odata.type"="Microsoft.Dynamics.CRM.LocalizedLabel";Label=$text;LanguageCode=1033} }
}
function rl { @{"@odata.type"="Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty";Value="None";CanBeChanged=$true;ManagedPropertyLogicalName="canmodifyrequirementlevelsettings"} }

function Add-Column($entityLogicalName, $attr) {
    $schemaName = $attr.SchemaName
    $logicalName = $schemaName.ToLower()

    # Check if column exists
    try {
        Invoke-RestMethod -Uri "$apiBase/EntityDefinitions(LogicalName='$entityLogicalName')/Attributes(LogicalName='$logicalName')?`$select=LogicalName" -Headers $headers -Method GET -ErrorAction Stop | Out-Null
        Write-Host "  SKIPPED  $logicalName (already exists)" -ForegroundColor DarkGray
        return
    } catch {
        if ($_.Exception.Response.StatusCode -ne 404) { throw }
    }

    $body = $attr | ConvertTo-Json -Depth 10
    try {
        Invoke-RestMethod -Uri "$apiBase/EntityDefinitions(LogicalName='$entityLogicalName')/Attributes" -Headers $headers -Method POST -Body $body | Out-Null
        Write-Host "  CREATED  $logicalName" -ForegroundColor Green
    } catch {
        $msg = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue).error.message
        Write-Host "  ERROR    $logicalName — $($msg ?? $_.Exception.Message)" -ForegroundColor Red
    }
}

$strAttr = {
    param($schema, $display, $max = 200)
    @{ "@odata.type"="Microsoft.Dynamics.CRM.StringAttributeMetadata"; SchemaName=$schema; DisplayName=lbl $display; RequiredLevel=rl; MaxLength=$max; FormatName=@{Value="Text"} }
}

Write-Host "`nAdding columns to lum_job..." -ForegroundColor Yellow

Add-Column "lum_job" (& $strAttr "lum_airtablerecordid" "Airtable Record ID" 50)
Add-Column "lum_job" (& $strAttr "lum_salesrep"         "Sales Rep"          500)
Add-Column "lum_job" (& $strAttr "lum_location"         "Location"           200)
Add-Column "lum_job" (& $strAttr "lum_recordtype"        "Record Type"        50)   # Active | Completed

Write-Host "`n=== Done. lum_job now has Airtable sync columns. ===" -ForegroundColor Cyan
Write-Host "Next: build the two Power Automate flows per platform-foundation/flows/04-airtable-sync-flows.md" -ForegroundColor Gray
